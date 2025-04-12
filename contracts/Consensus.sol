// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import "./IConsensus.sol";
import {ConsensusLib as Lib} from "./ConsensusLib.sol";

contract Consensus is IConsensus {
    address private _manager;
    uint256 private _monthlyQuota = 0.01 ether;

    mapping(address => bool) private _counselors;
    mapping(address => uint8) private _leaders;
    mapping(uint8 => bool) private _groups;
    mapping(bytes32 => Lib.Topic) private _topics;
    mapping(bytes32 => Lib.Vote[]) private _votings;

    constructor() {
        _manager = msg.sender;

        for (uint8 i = 1; i <= 10; i++) {
            _groups[i] = true;
        }
    }

    function openVoting(string memory _title) external restrictedToManager {
        require(topicExists(_title), "Topic does not exists");

        Lib.Topic memory topic = getTopic(_title);

        require(
            topic.status == Lib.Status.IDLE,
            "Only IDLE topics can be open for voting"
        );

        bytes32 topicId = keccak256(bytes(_title));

        _topics[topicId].status = Lib.Status.VOTING;
        _topics[topicId].startDate = block.timestamp;
    }

    function vote(
        string memory _title,
        Lib.Options _option
    ) external restrictedToGroupLeaders {
        require(topicExists(_title), "Topic does not exists");
        require(_option != Lib.Options.EMPTY, "Option can't be EMPTY");

        Lib.Topic memory topic = getTopic(_title);
        require(
            topic.status == Lib.Status.VOTING,
            "Only VOTING topics can be voted"
        );

        uint8 groupId = _leaders[tx.origin];

        bytes32 topicId = keccak256(bytes(_title));
        Lib.Vote[] memory votes = _votings[topicId];
        for (uint256 i = 0; i < votes.length; i++) {
            if (votes[i].leader == tx.origin) {
                revert("Leader already voted");
            }
        }

        Lib.Vote memory newVote = Lib.Vote({
            leader: tx.origin,
            group: groupId,
            option: _option,
            createdAt: block.timestamp
        });

        _votings[topicId].push(newVote);
    }

    function closeVoting(string memory _title) external restrictedToManager {
        Lib.Topic memory topic = getTopic(_title);

        require(topic.createdAt > 0, "Topic does not exists");
        require(
            topic.status == Lib.Status.VOTING,
            "Only VOTING topics can be closed"
        );

        uint8 minVotes = 3;

        if (topic.category == Lib.Category.SPENT) minVotes = 9;
        else if (topic.category == Lib.Category.CHANGE_QUOTA) minVotes = 12;
        else if (topic.category == Lib.Category.CHANGE_MANAGER) minVotes = 18;

        require(
            numberOfVotes(_title) >= minVotes,
            "You cannot close the voting because there are not enough votes"
        );

        uint256 approved = 0;
        uint256 denied = 0;
        uint256 abstention = 0;

        bytes32 topicId = keccak256(bytes(_title));
        Lib.Vote[] memory votes = _votings[topicId];

        for (uint256 i = 0; i < votes.length; i++) {
            if (votes[i].option == Lib.Options.YES) approved++;
            else if (votes[i].option == Lib.Options.NO) denied++;
            else abstention++;
        }

        Lib.Status newStatus = approved > denied
            ? Lib.Status.APPROVED
            : Lib.Status.DENIED;

        _topics[topicId].status = newStatus;
        _topics[topicId].endDate = block.timestamp;

        if (newStatus == Lib.Status.APPROVED)
            if (topic.category == Lib.Category.CHANGE_QUOTA)
                _monthlyQuota = topic.amount;
            else if (topic.category == Lib.Category.CHANGE_MANAGER)
                _manager = topic.responsible;
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

        delete _leaders[_leader];

        if (isCounselor(_leader)) delete _counselors[_leader];
    }

    function setManager(address _newManager) external restrictedToManager {
        require(_newManager != address(0), "Address can't be null");
        require(
            _newManager != _manager,
            "New manager can't be the current manager"
        );

        _manager = _newManager;
    }

    function getManager() external view returns (address) {
        return _manager;
    }

    function setCounselor(
        address _counselor,
        bool _isEntering
    ) external restrictedToManager {
        if (_isEntering) {
            require(!isCounselor(_counselor), "Counselor already exists");
            require(isLeader(_counselor), "Counselor is not a leader");

            _counselors[_counselor] = true;

            return;
        }

        require(isCounselor(_counselor), "Counselor does not exists");

        delete _counselors[_counselor];
    }

    function addTopic(
        string memory _title,
        string memory _description,
        Lib.Category _category,
        uint _amount,
        address _responsible
    ) external restrictedToGroupLeaders {
        require(!topicExists(_title), "Topic already exists");

        if (_amount > 0) {
            require(
                _category == Lib.Category.SPENT ||
                    _category == Lib.Category.CHANGE_QUOTA,
                "No amount allowed for this category"
            );
        }

        Lib.Topic memory newTopic = Lib.Topic({
            title: _title,
            description: _description,
            status: Lib.Status.IDLE,
            category: _category,
            amount: _amount,
            responsible: _responsible != address(0) ? _responsible : tx.origin,
            createdAt: block.timestamp,
            startDate: 0,
            endDate: 0
        });

        _topics[keccak256(bytes(newTopic.title))] = newTopic;
    }

    function removeTopic(string memory _title) external restrictedToManager {
        require(topicExists(_title), "Topic does not exists");

        Lib.Topic memory topic = getTopic(_title);

        require(
            topic.status == Lib.Status.IDLE,
            "Only IDLE topics can be removed"
        );

        delete _topics[keccak256(bytes(_title))];
    }

    function numberOfVotes(string memory _title) public view returns (uint256) {
        bytes32 topicId = keccak256(bytes(_title));
        return _votings[topicId].length;
    }

    function getTopic(
        string memory _title
    ) public view returns (Lib.Topic memory) {
        bytes32 topicId = keccak256(bytes(_title));
        return _topics[topicId];
    }

    function getMonthlyQuota() public view returns (uint256) {
        return _monthlyQuota;
    }

    function groupExists(uint8 _groupId) public view returns (bool) {
        return _groups[_groupId];
    }

    function topicExists(string memory _title) public view returns (bool) {
        return getTopic(_title).createdAt > 0;
    }

    function isCounselor(address _counselor) public view returns (bool) {
        return _counselors[_counselor];
    }

    function isLeader(address _groupLeader) public view returns (bool) {
        return _leaders[_groupLeader] > 0;
    }

    modifier restrictedToManager() {
        require(
            tx.origin == _manager,
            "Only the manager can call this function"
        );
        _;
    }

    modifier restrictedToCouncil() {
        require(
            tx.origin == _manager || _counselors[tx.origin],
            "Only the council members can call this function"
        );
        _;
    }

    modifier restrictedToGroupLeaders() {
        require(
            tx.origin == _manager || isLeader(tx.origin),
            "Only the group leaders can call this function"
        );
        _;
    }
}
