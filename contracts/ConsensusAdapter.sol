// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import "./IConsensus.sol";

contract ConsensusAdapter {
    IConsensus private _impl;
    address private immutable _owner;

    event QuotaChanged(uint256 amount);

    event ManagerChanged(address newManager);

    event TopicChanged(
        bytes32 indexed topicId,
        string title,
        Lib.Status indexed status
    );

    event Transfer(address to, uint indexed amout, string topic);

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

    function openVoting(string memory _title) external upgraded {
        _impl.openVoting(_title);
    }

    function vote(string memory _title, Lib.Options _option) external upgraded {
        _impl.vote(_title, _option);
    }

    function closeVoting(string memory _title) external upgraded {
        _impl.closeVoting(_title);
    }

    function addLeader(address _leader, uint8 _groupId) external upgraded {
        _impl.addLeader(_leader, _groupId);
    }

    function removeLeader(address _leader, uint8 _groupId) external upgraded {
        _impl.removeLeader(_leader, _groupId);
    }

    function setManager(address _newManager) external upgraded {
        _impl.setManager(_newManager);
    }

    function getManager() external view upgraded returns (address) {
        return _impl.getManager();
    }

    function getMonthlyQuota() external view upgraded returns (uint256) {
        return _impl.getMonthlyQuota();
    }

    function payQuota(uint8 _groupId) external payable upgraded {
        _impl.payQuota{value: msg.value}(_groupId);
    }

    function setCounselor(
        address _counselor,
        bool _isEntering
    ) external upgraded {
        _impl.setCounselor(_counselor, _isEntering);
    }

    function addTopic(
        string memory _title,
        string memory _description,
        Lib.Category _category,
        uint _amount,
        address _responsible
    ) external upgraded {
        _impl.addTopic(_title, _description, _category, _amount, _responsible);
    }

    function removeTopic(string memory title) external upgraded {
        _impl.removeTopic(title);
    }

    function editTopic(
        string memory _title,
        string memory _description,
        uint _amount,
        address _responsible
    ) external upgraded {
        _impl.editTopic(_title, _description, _amount, _responsible);
    }

    function getPayment(
        uint8 _groupId
    ) external view upgraded returns (uint256) {
        return _impl.getPayment(_groupId);
    }

    function numberOfVotes(
        string memory _title
    ) external view upgraded returns (uint256) {
        return _impl.numberOfVotes(_title);
    }

    function transfer(
        string memory _topicTitle,
        uint256 _amount
    ) external upgraded {
        _impl.transfer(_topicTitle, _amount);
    }

    modifier upgraded() {
        require(address(_impl) != address(0), "Contract not upgraded");
        _;
    }
}
