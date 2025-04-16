// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import "../interface/IConsensus.sol";
import {ConsensusLib as Lib} from "../library/ConsensusLib.sol";

interface IConsensus {
    // ------------------------------------------------------------------------
    // Voting functions
    // ------------------------------------------------------------------------
    function openVoting(
        string memory _title
    ) external returns (Lib.TopicUpdate memory);

    function vote(string memory _title, Lib.Options _option) external;

    function closeVoting(
        string memory _title
    ) external returns (Lib.TopicUpdate memory);

    function getVotes(
        string memory _title
    ) external view returns (Lib.Vote[] memory);

    // ------------------------------------------------------------------------
    // Membership functions
    // ------------------------------------------------------------------------
    function addLeader(address _leader, uint8 _groupId) external;

    function removeLeader(address _leader, uint8 _groupId) external;

    function setManager(address _newManager) external;

    function setCounselor(address _counselor, bool _isEntering) external;

    function getManager() external view returns (address);

    function getLeader(
        address _leader
    ) external view returns (Lib.Leader memory);

    function getLeaders(
        uint page,
        uint pageSize
    ) external view returns (Lib.LeaderPage memory);

    // ------------------------------------------------------------------------
    // Topic functions
    // ------------------------------------------------------------------------
    function editTopic(
        string memory _topicToEdit,
        string memory _description,
        uint _amount,
        address _responsible
    ) external returns (Lib.TopicUpdate memory);

    function addTopic(
        string memory _title,
        string memory _description,
        Lib.Category _category,
        uint _amount,
        address _responsible
    ) external;

    function removeTopic(
        string memory _title
    ) external returns (Lib.TopicUpdate memory);

    function numberOfVotes(
        string memory _title
    ) external view returns (uint256);

    function getTopic(
        string memory _title
    ) external view returns (Lib.Topic memory);

    function getTopics(
        uint page,
        uint pageSize
    ) external view returns (Lib.TopicPage memory);

    // ------------------------------------------------------------------------
    // Payment functions
    // ------------------------------------------------------------------------
    function payQuota(uint8 _groupId) external payable;

    function transfer(
        string memory _topicTitle,
        uint256 _amount
    ) external returns (Lib.TransferReceipt memory);

    function getQuota() external view returns (uint256);
}
