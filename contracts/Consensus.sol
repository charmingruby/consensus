// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract Consensus {
    address private _manager;
    mapping(address => bool) private _counselors;
    mapping(address => uint8) private _leaders;
    mapping(uint8 => bool) private _groups;

    constructor() {
        _manager = msg.sender;

        for (uint8 i = 1; i <= 10; i++) {
            _groups[i] = true;
        }
    }

    function addLeader(
        address _leader,
        uint8 _groupId
    ) external restrictedToCouncil {
        require(groupExists(_groupId), "Group does not exists");

        _leaders[_leader] = _groupId;
    }

    function removeLeader(
        address _leader,
        uint8 _groupId
    ) external restrictedToManager {
        require(groupExists(_groupId), "Group does not exists");
        require(isLeader(_leader), "Leader does not exists");

        _leaders[_leader] = 0;
    }

    function groupExists(uint8 _groupId) public view returns (bool) {
        return _groups[_groupId];
    }

    function isLeader(address _groupLeader) public view returns (bool) {
        return _leaders[_groupLeader] > 0;
    }

    modifier restrictedToManager() {
        require(
            msg.sender == _manager,
            "Only the manager can call this function"
        );
        _;
    }

    modifier restrictedToCouncil() {
        require(
            msg.sender == _manager || _counselors[msg.sender],
            "Only the council members can call this function"
        );
        _;
    }

    modifier restrictedToGroupLeaders() {
        require(
            msg.sender == _manager || isLeader(msg.sender),
            "Only the group leaders can call this function"
        );
        _;
    }
}
