// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import {ConsensusLib as Lib} from "./ConsensusLib.sol";

interface IConsensus {
    function openVoting(string memory _title) external;

    function vote(string memory _title, Lib.Options _option) external;

    function closeVoting(string memory _title) external;

    function addLeader(address _leader, uint8 _groupId) external;

    function removeLeader(address _leader, uint8 _groupId) external;

    function setManager(address _newManager) external;

    function getManager() external view returns (address);

    function setCounselor(address _counselor, bool _isEntering) external;

    function getMonthlyQuota() external view returns (uint256);

    function getPayment(uint8 _groupId) external view returns (uint256);

    function payQuota(uint8 _groupId) external payable;

    function editTopic(
        string memory _topicToEdit,
        string memory _description,
        uint _amount,
        address _responsible
    ) external;

    function addTopic(
        string memory _title,
        string memory _description,
        Lib.Category _category,
        uint _amount,
        address _responsible
    ) external;

    function removeTopic(string memory _title) external;

    function numberOfVotes(
        string memory _title
    ) external view returns (uint256);

    function transfer(string memory _topicTitle, uint256 _amount) external;
}
