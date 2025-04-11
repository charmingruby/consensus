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

    function openVoting(string memory title) external {
        _impl.openVoting(title);
    }

    function vote(string memory title, Lib.Options _option) external {
        _impl.vote(title, _option);
    }

    function closeVoting(string memory title) external {
        _impl.closeVoting(title);
    }

    function addLeader(address leader, uint8 _groupId) external {
        _impl.addLeader(leader, _groupId);
    }

    function removeLeader(address leader, uint8 _groupId) external {
        _impl.removeLeader(leader, _groupId);
    }

    function setManager(address newManager) external {
        _impl.setManager(newManager);
    }

    function getManager() external view returns (address) {
        return _impl.getManager();
    }

    function setCounselor(address counselor, bool _isEntering) external {
        _impl.setCounselor(counselor, _isEntering);
    }

    function addTopic(
        string memory title,
        string memory _description
    ) external {
        _impl.addTopic(title, _description);
    }

    function removeTopic(string memory title) external {
        _impl.removeTopic(title);
    }

    function numberOfVotes(
        string memory title
    ) external view returns (uint256) {
        return _impl.numberOfVotes(title);
    }
}
