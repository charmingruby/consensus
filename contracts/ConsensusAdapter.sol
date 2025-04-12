// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import "./IConsensus.sol";

contract ConsensusAdapter {
    IConsensus private _impl;
    address private immutable _owner;

    constructor() {
        _owner = msg.sender;
    }

    function upgrade(address _newContract) external {
        require(msg.sender == _owner, "Only owner can upgrade");
        require(_newContract != address(0), "New contract address cannot be 0");

        _impl = IConsensus(_newContract);
    }

    function getImplAddress() external view returns (address) {
        return address(_impl);
    }

    function openVoting(string memory title) external upgraded {
        _impl.openVoting(title);
    }

    function vote(string memory title, Lib.Options _option) external upgraded {
        _impl.vote(title, _option);
    }

    function closeVoting(string memory title) external upgraded {
        _impl.closeVoting(title);
    }

    function addLeader(address leader, uint8 _groupId) external upgraded {
        _impl.addLeader(leader, _groupId);
    }

    function removeLeader(address leader, uint8 _groupId) external upgraded {
        _impl.removeLeader(leader, _groupId);
    }

    function setManager(address newManager) external upgraded {
        _impl.setManager(newManager);
    }

    function getManager() external view upgraded returns (address) {
        return _impl.getManager();
    }

    function getMonthlyQuota() external view upgraded returns (uint256) {
        return _impl.getMonthlyQuota();
    }

    function setCounselor(
        address counselor,
        bool _isEntering
    ) external upgraded {
        _impl.setCounselor(counselor, _isEntering);
    }

    function addTopic(
        string memory title,
        string memory _description,
        Lib.Category _category,
        uint amount,
        address responsible
    ) external upgraded {
        _impl.addTopic(title, _description, _category, amount, responsible);
    }

    function removeTopic(string memory title) external upgraded {
        _impl.removeTopic(title);
    }

    function editTopic(
        string memory title,
        string memory _description,
        uint amount,
        address responsible
    ) external upgraded {
        _impl.editTopic(title, _description, amount, responsible);
    }

    function numberOfVotes(
        string memory title
    ) external view upgraded returns (uint256) {
        return _impl.numberOfVotes(title);
    }

    modifier upgraded() {
        require(address(_impl) != address(0), "Contract not upgraded");
        _;
    }
}
