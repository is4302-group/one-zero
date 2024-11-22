# One Zero

A binary options marketplace.

## Features

- stake platform token on long and short options
- automatic payout when option expires

## Usage

- Compile the contracts

  ```bash
  npx hardhat compile
  ```

- Test the contracts

  ```bash
  npx hardhat test --parallel
  ```

## Contracts

- CommissionToken.sol
  - for tracking ownership of shares of the commissions
  - lazily compute and claim commissions
- Market.sol
  - manages automation and interactions of options and users
  - manages payouts for commissions and winnings
- Storage.sol
  - stores option metadata
  - stores user's stakes in different options

## Walkthrough

### Creating options

- option is created on the market
  - Market.addBinaryOption (Market.sol:142)

### Option is available for staking

- users place their stakes on the option (long/short)
  - Market.addPosition (Market.sol:160)
- chainlink keepers continuously poll market to clean up concluded options
  - Market.checkUpkeep (Market.sol:255)
  - Market.performUpkeep (Market.sol:287)

### Option has concluded

> In chainlink upkeep method, concludeBinaryOption (Market.sol:181) is called
> The following is a walkthrough of what happens when an option is concluded

- outcome is retrieved from an oracle
  - Market.retrieveOutcome (Market.sol:211)
- winnings are paid out to winners
  - Market.payOutWinnings (Market.sol:227)
- commissions are sent to the commission token contract
  - Market.payOutCommission (Market.sol:220)

### Commission management

- commission token holders claim commissions for periods from their last claimed
  period up to the current period
  - CommissionToken.claimCommission (CommissionToken.sol:43)
