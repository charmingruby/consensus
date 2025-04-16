// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

library Validator {
    function isAddressNotNull(address _address) public pure returns (bool) {
        return _address != address(0);
    }

    function isStringEqual(
        string memory _strA,
        string memory _strB
    ) public pure returns (bool) {
        return keccak256(bytes(_strA)) == keccak256(bytes(_strB));
    }
}
