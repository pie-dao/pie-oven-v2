import { constants, utils } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers, network } from "hardhat";
import { ICurveAddressProvider__factory } from "../typechain/factories/ICurveAddressProvider__factory";
import { ICurveExchange__factory } from "../typechain/factories/ICurveExchange__factory";

const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const TUSD = "0x0000000000085d4780B73119b644AE5ecd22b376";
const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
const sUSD = "0x57ab1ec28d129707052df4df418d58a2d46d5f51";

const addressProviderAddress = "0x0000000022D53366457F9d5E68Ec105046FC4383";

const from = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const amount = ethers.BigNumber.from("100000000"); // 100 USDC

const main = async () => {
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [from]}
    )
    
    const signer = ethers.provider.getSigner(from);
    const addressProvider = ICurveAddressProvider__factory.connect(addressProviderAddress, signer);
    const exchangeAddress = await addressProvider.get_address(ethers.BigNumber.from(2));
    console.log(`Curve Swap contract address: ${exchangeAddress}`);

    const exchange = ICurveExchange__factory.connect(exchangeAddress, signer);

    // gasEstimation for get_best_rate
    let gasEstimation = await exchange.estimateGas.get_best_rate(USDC, DAI, amount);
    console.log(`Gas estimation for get_best_rate: ${gasEstimation.toString()}`);

    // getting the result
    let result = await exchange.get_best_rate(USDC, DAI, amount);
    console.log(`Best pool is ${result[0]} receiving ${result[1].toString()} DAI`);
}

main();