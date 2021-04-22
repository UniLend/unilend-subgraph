import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import {
  Core,
  Deposit,
  FlashLoan,
  PoolCreated,
  RedeemUnderlying,
} from "../generated/Core/Core";
import { IERC20 } from "../generated/Core/IERC20";
import { UnilendFDonation } from "../generated/Core/UnilendFDonation";
import {
  FlashLoanEntity,
  DepositEntity,
  Token,
  RedeemUnderlyingEntity,
} from "../generated/schema";
import {
  convertTokenToDecimal,
  DAY_BI,
  fetchTokenDecimals,
  fetchTokenName,
  fetchTokenSymbol,
  fetchTokenTotalSupply,
  SIXTY_BI,
  YEAR_BI,
  ZERO_BD,
  ZERO_BI,
} from "./helpers";

export function handleDeposit(event: Deposit): void {
  let deposit = DepositEntity.load(event.transaction.hash.toHexString());
  let token0 = Token.load(event.params._reserve.toHexString());
  let depositContract = Core.bind(event.address);
  let IERC20Contract = IERC20.bind(event.params._reserve);

  let donateAddress = depositContract.donationAddress();
  if (token0 === null) {
    token0 = new Token(event.params._reserve.toHexString());
    token0.symbol = fetchTokenSymbol(event.params._reserve);
    token0.name = fetchTokenName(event.params._reserve);
    token0.totalSupply = fetchTokenTotalSupply(event.params._reserve);
    let decimals = fetchTokenDecimals(event.params._reserve);
    // bail if we couldn't figure out the decimals
    if (decimals === null) {
      log.debug("mybug the decimal on token 0 was null", []);
      return;
    }
    // let tokenContract;
    token0.decimals = decimals;
    token0.derivedETH = ZERO_BD;
    token0.tradeVolume = ZERO_BD;
    token0.tradeVolumeUSD = ZERO_BD;
    token0.untrackedVolumeUSD = ZERO_BD;
    token0.totalLiquidity = ZERO_BD;
    token0.releaseRate = ZERO_BD;
    token0.totalRewardPool = ZERO_BD;
    token0.apy = ZERO_BD;
    token0.totalFlashLoan = ZERO_BD;
    token0.txCount = ZERO_BI;
  }
  if (deposit === null) {
    deposit = new DepositEntity(event.transaction.hash.toHexString());
    deposit.reserve = event.params._reserve.toHexString();
    deposit.amount = event.params._amount.toBigDecimal();
    deposit.user = event.params._user.toHexString();
    deposit.timestamp = event.params._timestamp;

    let liquidity = ZERO_BI.plus(
      depositContract.balanceOfUnderlying(
        event.params._reserve,
        event.params._user,
        event.params._timestamp
      )
    );
    token0.totalLiquidity = convertTokenToDecimal(liquidity, token0.decimals);
  }
  let contract = UnilendFDonation.bind(donateAddress);
  let releaseRate = contract.getReleaseRate(event.params._reserve);
  let deciReleaseRate = convertTokenToDecimal(releaseRate, token0.decimals);
  let day = SIXTY_BI.times(SIXTY_BI).times(DAY_BI);
  token0.releaseRate = token0.releaseRate.plus(deciReleaseRate.times(day));
  let rewardPoolTotal = IERC20Contract.balanceOf(donateAddress);
  token0.totalRewardPool = convertTokenToDecimal(
    rewardPoolTotal,
    token0.decimals
  );
  let totalDepositedToken = IERC20Contract.balanceOf(event.address);

  let year = SIXTY_BI.times(SIXTY_BI)
    .times(DAY_BI)
    .times(YEAR_BI);
  token0.apy = convertTokenToDecimal(releaseRate, token0.decimals)
    .times(year)
    .times(
      convertTokenToDecimal(rewardPoolTotal, token0.decimals).div(
        convertTokenToDecimal(totalDepositedToken, token0.decimals)
      )
    );

  deposit.save();
  token0.save();
}

export function handleFlashLoan(event: FlashLoan): void {
  let flashLoan = FlashLoanEntity.load(event.transaction.hash.toHexString());
  if (flashLoan === null) {
    flashLoan = new FlashLoanEntity(event.transaction.hash.toHexString());

    flashLoan.amount = event.params._amount.toBigDecimal();
    flashLoan.reserve = event.params._reserve.toHexString();
    flashLoan.target = event.params._target.toHexString();
    flashLoan.totalFee = event.params._totalFee;
    flashLoan.timestamp = event.params._timestamp;
  }
  flashLoan.save();
}

export function handlePoolCreated(event: PoolCreated): void {}

export function handleRedeemUnderlying(event: RedeemUnderlying): void {
  let redeemUnderlying = RedeemUnderlyingEntity.load(
    event.transaction.hash.toHexString()
  );
  if (redeemUnderlying === null) {
    redeemUnderlying = new RedeemUnderlyingEntity(
      event.transaction.hash.toHexString()
    );
  }
  redeemUnderlying.save();
}
