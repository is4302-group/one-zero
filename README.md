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

- option is created on the market
- option is made available for staking
  - users place their stakes on the option (long/short)
  - chainlink keepers continuously poll market to clean up concluded options
- when an option has concluded
  - outcome is retrieved from an oracle
  - winnings are paid out to winners
    - total stake (long + short) divided among winners (long/short)
  - commissions are sent to the commission token contract
- commission token holders claim their commissions
  - amount claimed determined by balance of commission tokens
  - last collected commission is tracked to prevent double counting
