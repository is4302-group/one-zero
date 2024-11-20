# One Zero

A binary options marketplace.

## Features

- stake platform token on long and short options
- automatic payout when option expires

## Contracts

- Commissions.sol
  - placeholder
- GovernanceToken.sol
  - is our custom ERC20 token, with a maximum cap for the tokens
- Marketplace.sol
  - is the main contract (as much as possible, most of the logic is in
    storage.sol cause when we need to document the transition to optimised
    architecture, we can say that the storage.sol logic will all be performed
    off-chain) dummy code for retrieval of outcome from oracle also included
- Storage.sol
  - will store all the binary options and information required to track stakers,
    users' participated options etc
- TimeCheck.sol
  - to check the current timestamp of the blockchain
