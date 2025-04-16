// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import "../interface/IConsensus.sol";

import {ConsensusLib} from "../library/ConsensusLib.sol";
import {Validator} from "../library/Validator.sol";

contract Consensus is IConsensus {
    using Validator for address;
    using Validator for string;

    // ------------------------------------------------------------------------
    // State Variables
    // ------------------------------------------------------------------------
    uint256 private _monthlyQuota = 0.01 ether;

    address public manager;

    address[] public counselors;

    ConsensusLib.Leader[] public leaders;
    mapping(address => uint8) private _leaderIdx;

    mapping(uint8 => bool) public groups;

    ConsensusLib.Topic[] public topics;
    mapping(bytes32 => uint256) private _topicIdx;

    mapping(bytes32 => ConsensusLib.Vote[]) private _votings;

    mapping(uint8 => uint256) private _nextPayment;

    uint private constant PAYMENT_INTERVAL = 30 * 24 * 60 * 60;

    // ------------------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------------------
    modifier validAddress(address _address) {
        require(_address.isAddressNotNull(), "Address can't be null");
        _;
    }

    modifier onlyManager() {
        require(
            tx.origin == manager,
            "Only the manager can call this function"
        );
        _;
    }

    modifier onlyCouncil() {
        if (tx.origin != manager) {
            require(
                _isCounselor(tx.origin),
                "Only the council members can call this function"
            );
        }
        _;
    }

    modifier onlyLeader() {
        if (tx.origin != manager) {
            require(
                _isLeader(tx.origin),
                "Only the group leaders can call this function"
            );

            ConsensusLib.Leader memory leader = _getLeader(tx.origin);

            require(
                block.timestamp <= leader.nextPayment,
                "The leader must be defaulter"
            );
        }
        _;
    }

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------
    constructor() {
        manager = msg.sender;

        for (uint8 i = 1; i <= 50; i++) {
            groups[i] = true;
        }
    }

    // ------------------------------------------------------------------------
    // Payment Logic
    // ------------------------------------------------------------------------
    function transfer(
        string memory _topicTitle,
        uint256 _amount
    ) external onlyManager returns (ConsensusLib.TransferReceipt memory) {
        require(_topicExists(_topicTitle), "Topic does not exists");
        require(address(this).balance >= _amount, "Insufficient funds");

        ConsensusLib.Topic memory topic = _getTopic(_topicTitle);

        require(
            topic.status == ConsensusLib.Status.APPROVED &&
                topic.category == ConsensusLib.Category.SPENT,
            "Only APPROVED SPENT topics can be used for transfers"
        );

        require(topic.amount >= _amount, "Insufficient funds");

        payable(topic.responsible).transfer(_amount);

        bytes32 topicId = keccak256(bytes(_topicTitle));

        uint idx = _topicIdx[topicId];

        topics[idx].status = ConsensusLib.Status.SPENT;

        return
            ConsensusLib.TransferReceipt({
                to: topic.responsible,
                amount: _amount,
                topic: _topicTitle
            });
    }

    function payQuota(uint8 _groupId) external payable {
        require(_groupExists(_groupId), "Group does not exists");
        require(msg.value == _monthlyQuota, "Invalid amount");
        require(
            block.timestamp > _nextPayment[_groupId],
            "Payment already made"
        );

        if (_nextPayment[_groupId] == 0)
            _nextPayment[_groupId] = block.timestamp + PAYMENT_INTERVAL;
        else _nextPayment[_groupId] += PAYMENT_INTERVAL;
    }

    // ------------------------------------------------------------------------
    // Topic Logic
    // ------------------------------------------------------------------------
    function editTopic(
        string memory _topicToEdit,
        string memory _description,
        uint _amount,
        address _responsible
    ) external onlyManager returns (ConsensusLib.TopicUpdate memory) {
        require(_topicExists(_topicToEdit), "Topic does not exists");

        ConsensusLib.Topic memory topic = _getTopic(_topicToEdit);

        require(
            topic.status == ConsensusLib.Status.IDLE,
            "Only IDLE topics can be edited"
        );

        bool descriptionChanged = bytes(_description).length > 0 &&
            !_description.isStringEqual(topic.description);

        bool amountChanged = _amount >= 0 && _amount != topic.amount;

        bool responsibleChanged = _responsible != address(0) &&
            _responsible != topic.responsible;

        bool hasChanged = descriptionChanged ||
            amountChanged ||
            responsibleChanged;

        if (!hasChanged) revert("No changes");

        bytes32 topicId = keccak256(bytes(_topicToEdit));
        uint idx = _topicIdx[topicId];

        if (descriptionChanged) topics[idx].description = _description;
        if (amountChanged) topics[idx].amount = _amount;
        if (responsibleChanged) topics[idx].responsible = _responsible;

        return
            ConsensusLib.TopicUpdate({
                topicId: topicId,
                title: _topicToEdit,
                status: topic.status,
                category: topic.category
            });
    }

    function addTopic(
        string memory _title,
        string memory _description,
        ConsensusLib.Category _category,
        uint _amount,
        address _responsible
    ) external onlyLeader {
        require(!_topicExists(_title), "Topic already exists");

        if (_amount > 0) {
            require(
                _category == ConsensusLib.Category.SPENT ||
                    _category == ConsensusLib.Category.CHANGE_QUOTA,
                "No amount allowed for this category"
            );
        }

        ConsensusLib.Topic memory newTopic = ConsensusLib.Topic({
            title: _title,
            description: _description,
            status: ConsensusLib.Status.IDLE,
            category: _category,
            amount: _amount,
            responsible: _responsible != address(0) ? _responsible : tx.origin,
            createdAt: block.timestamp,
            startDate: 0,
            endDate: 0
        });

        _topicIdx[keccak256(bytes(newTopic.title))] = topics.length;
        topics.push(newTopic);
    }

    function removeTopic(
        string memory _title
    ) external onlyManager returns (ConsensusLib.TopicUpdate memory) {
        require(_topicExists(_title), "Topic does not exists");

        ConsensusLib.Topic memory topic = _getTopic(_title);

        require(
            topic.status == ConsensusLib.Status.IDLE,
            "Only IDLE topics can be removed"
        );

        bytes32 topicId = keccak256(bytes(_title));

        uint idx = _topicIdx[topicId];

        if (idx < topics.length - 1) {
            ConsensusLib.Topic memory latest = topics[topics.length - 1];
            topics[idx] = latest;
            _topicIdx[keccak256(bytes(latest.title))] = idx;
        }

        topics.pop();
        delete _topicIdx[topicId];

        return
            ConsensusLib.TopicUpdate({
                topicId: topicId,
                title: _title,
                status: ConsensusLib.Status.DELETED,
                category: topic.category
            });
    }

    // ------------------------------------------------------------------------
    // Voting Logic
    // ------------------------------------------------------------------------
    function openVoting(
        string memory _title
    ) external onlyManager returns (ConsensusLib.TopicUpdate memory) {
        require(_topicExists(_title), "Topic does not exists");

        ConsensusLib.Topic memory topic = _getTopic(_title);

        require(
            topic.status == ConsensusLib.Status.IDLE,
            "Only IDLE topics can be open for voting"
        );

        bytes32 topicId = keccak256(bytes(_title));

        uint idx = _topicIdx[topicId];

        topics[idx].status = ConsensusLib.Status.VOTING;
        topics[idx].startDate = block.timestamp;

        return
            ConsensusLib.TopicUpdate({
                topicId: topicId,
                title: _title,
                status: ConsensusLib.Status.VOTING,
                category: topic.category
            });
    }

    function vote(
        string memory _title,
        ConsensusLib.Options _option
    ) external onlyLeader {
        require(_topicExists(_title), "Topic does not exists");
        require(_option != ConsensusLib.Options.EMPTY, "Option can't be EMPTY");

        ConsensusLib.Topic memory topic = _getTopic(_title);
        require(
            topic.status == ConsensusLib.Status.VOTING,
            "Only VOTING topics can be voted"
        );

        uint8 groupId = leaders[_leaderIdx[tx.origin]].group;

        bytes32 topicId = keccak256(bytes(_title));
        ConsensusLib.Vote[] memory votes = _votings[topicId];
        for (uint256 i = 0; i < votes.length; i++) {
            if (votes[i].leader == tx.origin) {
                revert("Leader already voted");
            }
        }

        ConsensusLib.Vote memory newVote = ConsensusLib.Vote({
            leader: tx.origin,
            group: groupId,
            option: _option,
            createdAt: block.timestamp
        });

        _votings[topicId].push(newVote);
    }

    function closeVoting(
        string memory _title
    ) external onlyManager returns (ConsensusLib.TopicUpdate memory) {
        ConsensusLib.Topic memory topic = _getTopic(_title);

        require(topic.createdAt > 0, "Topic does not exists");
        require(
            topic.status == ConsensusLib.Status.VOTING,
            "Only VOTING topics can be closed"
        );

        uint8 minVotes = 3;

        if (topic.category == ConsensusLib.Category.SPENT) minVotes = 9;
        else if (topic.category == ConsensusLib.Category.CHANGE_QUOTA)
            minVotes = 12;
        else if (topic.category == ConsensusLib.Category.CHANGE_MANAGER)
            minVotes = 18;

        require(
            numberOfVotes(_title) >= minVotes,
            "You cannot close the voting because there are not enough votes"
        );

        uint256 approved = 0;
        uint256 denied = 0;
        uint256 abstention = 0;

        bytes32 topicId = keccak256(bytes(_title));
        ConsensusLib.Vote[] memory votes = _votings[topicId];

        for (uint256 i = 0; i < votes.length; i++) {
            if (votes[i].option == ConsensusLib.Options.YES) approved++;
            else if (votes[i].option == ConsensusLib.Options.NO) denied++;
            else abstention++;
        }

        ConsensusLib.Status newStatus = approved > denied
            ? ConsensusLib.Status.APPROVED
            : ConsensusLib.Status.DENIED;

        uint idx = _topicIdx[topicId];

        topics[idx].status = newStatus;
        topics[idx].endDate = block.timestamp;

        if (newStatus == ConsensusLib.Status.APPROVED)
            if (topic.category == ConsensusLib.Category.CHANGE_QUOTA)
                _monthlyQuota = topic.amount;
            else if (topic.category == ConsensusLib.Category.CHANGE_MANAGER) {
                if (_isLeader(manager))
                    leaders[_leaderIdx[manager]].isManager = false;

                manager = topic.responsible;

                if (_isLeader(topic.responsible))
                    leaders[_leaderIdx[topic.responsible]].isManager = true;
            }

        return
            ConsensusLib.TopicUpdate({
                topicId: topicId,
                title: _title,
                status: newStatus,
                category: topic.category
            });
    }

    function numberOfVotes(string memory _title) public view returns (uint256) {
        bytes32 topicId = keccak256(bytes(_title));
        return _votings[topicId].length;
    }

    // ------------------------------------------------------------------------
    // Membership Logic
    // ------------------------------------------------------------------------
    function setCounselor(
        address _counselor,
        bool _isEntering
    ) external onlyManager validAddress(_counselor) {
        if (_isEntering) return _addCounselor(_counselor);
        else _removeCounselor(_counselor);
    }

    function addLeader(
        address _leader,
        uint8 _groupId
    ) external onlyCouncil validAddress(_leader) {
        require(_groupExists(_groupId), "Group does not exists");

        leaders.push(
            ConsensusLib.Leader({
                wallet: _leader,
                group: _groupId,
                isManager: false,
                isCounselor: false,
                nextPayment: 0
            })
        );

        _leaderIdx[_leader] = uint8(leaders.length - 1);
    }

    function removeLeader(
        address _leader,
        uint8 _groupId
    ) external onlyManager {
        require(_groupExists(_groupId), "Group does not exists");
        require(_isLeader(_leader), "Leader does not exists");

        uint8 idx = _leaderIdx[_leader];

        if (idx < leaders.length - 1) {
            ConsensusLib.Leader memory latest = leaders[leaders.length - 1];
            leaders[idx] = latest;
            _leaderIdx[latest.wallet] = idx;
        }

        leaders.pop();

        delete _leaderIdx[_leader];
    }

    function setManager(
        address _newManager
    ) external onlyManager validAddress(_newManager) {
        require(_newManager != address(0), "Address can't be null");
        require(
            _newManager != manager,
            "New manager can't be the current manager"
        );

        if (_isLeader(manager)) leaders[_leaderIdx[manager]].isManager = false;

        manager = _newManager;

        if (_isLeader(_newManager))
            leaders[_leaderIdx[_newManager]].isManager = true;
    }

    function _addCounselor(
        address _counselor
    ) private onlyManager validAddress(_counselor) {
        require(!_isCounselor(_counselor), "Counselor already exists");
        require(_isLeader(_counselor), "Counselor is not a leader");

        counselors.push(_counselor);

        leaders[_leaderIdx[_counselor]].isCounselor = true;
    }

    function _removeCounselor(
        address _counselor
    ) private onlyManager validAddress(_counselor) {
        require(_isCounselor(_counselor), "Counselor does not exists");

        uint idx = 1000000;

        for (uint i = 0; i < counselors.length; i++) {
            if (counselors[i] == _counselor) {
                idx = i;
                break;
            }
        }

        require(idx != 1000000, "Counselor does not exists");

        if (idx != counselors.length - 1) {
            address latest = counselors[counselors.length - 1];

            counselors[idx] = latest;
        }

        counselors.pop();

        leaders[_leaderIdx[_counselor]].isCounselor = false;
    }

    // ------------------------------------------------------------------------
    // Getters
    // ------------------------------------------------------------------------
    function getVotes(
        string memory _title
    ) external view returns (ConsensusLib.Vote[] memory) {
        return _votings[keccak256(bytes(_title))];
    }

    function getTopic(
        string memory _title
    ) external view returns (ConsensusLib.Topic memory) {
        return _getTopic(_title);
    }

    function getTopics(
        uint page,
        uint pageSize
    ) external view returns (ConsensusLib.TopicPage memory) {
        require(page > 0, "Page must be greater than 0");
        require(pageSize > 0, "Page size must be greater than 0");

        uint totalTopics = topics.length;
        uint startIndex = (page - 1) * pageSize;
        uint endIndex = startIndex + pageSize;

        if (startIndex >= totalTopics) {
            return
                ConsensusLib.TopicPage({
                    topics: new ConsensusLib.Topic[](0),
                    total: totalTopics
                });
        }

        if (endIndex > totalTopics) {
            endIndex = totalTopics;
        }

        uint resultSize = endIndex - startIndex;
        ConsensusLib.Topic[] memory result = new ConsensusLib.Topic[](
            resultSize
        );

        for (uint i = 0; i < resultSize; i++) {
            result[i] = topics[startIndex + i];
        }

        return ConsensusLib.TopicPage({topics: result, total: totalTopics});
    }

    function getQuota() external view returns (uint256) {
        return _monthlyQuota;
    }

    function getManager() external view returns (address) {
        return manager;
    }

    function getCounselors() external view returns (address[] memory) {
        return counselors;
    }

    function getLeader(
        address _leader
    ) external view returns (ConsensusLib.Leader memory) {
        return _getLeader(_leader);
    }

    function getLeaders(
        uint page,
        uint pageSize
    ) external view returns (ConsensusLib.LeaderPage memory) {
        ConsensusLib.Leader[] memory result = new ConsensusLib.Leader[](
            pageSize
        );

        uint skip = (page - 1) * pageSize;
        uint idx = 0;

        for (uint i = skip; i < skip + pageSize && i < leaders.length; i++) {
            result[idx++] = _getLeader(leaders[i].wallet);
        }

        return
            ConsensusLib.LeaderPage({leaders: result, total: leaders.length});
    }

    function _getTopic(
        string memory _title
    ) private view returns (ConsensusLib.Topic memory) {
        bytes32 topicId = keccak256(bytes(_title));

        uint idx = _topicIdx[topicId];

        if (idx < topics.length) {
            ConsensusLib.Topic memory result = topics[idx];

            if (keccak256(bytes(result.title)) == topicId) {
                return result;
            }
        }

        return
            ConsensusLib.Topic({
                title: "",
                description: "",
                status: ConsensusLib.Status.DELETED,
                category: ConsensusLib.Category.DECISION,
                amount: 0,
                responsible: address(0),
                createdAt: 0,
                startDate: 0,
                endDate: 0
            });
    }

    function _getLeader(
        address _leader
    ) private view returns (ConsensusLib.Leader memory) {
        uint8 idx = _leaderIdx[_leader];

        if (idx < leaders.length) {
            ConsensusLib.Leader memory result = leaders[idx];

            if (result.wallet == _leader) {
                result.nextPayment = _nextPayment[result.group];

                return result;
            }
        }

        return
            ConsensusLib.Leader({
                wallet: address(0),
                group: 0,
                isCounselor: false,
                isManager: false,
                nextPayment: 0
            });
    }

    // ------------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------------
    function _isCounselor(address _counselor) private view returns (bool) {
        for (uint i = 0; i < counselors.length; i++) {
            if (counselors[i] == _counselor) return true;
        }

        return false;
    }

    function _groupExists(uint8 _groupId) private view returns (bool) {
        return groups[_groupId];
    }

    function _topicExists(string memory _title) private view returns (bool) {
        return _getTopic(_title).createdAt > 0;
    }

    function _isLeader(address _leader) private view returns (bool) {
        return _getLeader(_leader).group > 0;
    }
}
