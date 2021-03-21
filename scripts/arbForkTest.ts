import { constants, utils } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers, network } from "hardhat";
import { IERC20__factory } from "../typechain";

import { ArbRecipe__factory } from "../typechain/factories/ArbRecipe__factory";

const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const YPIE = "0x17525e4f4af59fbc29551bc4ece6ab60ed49ce31";

const FROM = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

const main = async () => {
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [FROM]}
    )

    const signer = ethers.provider.getSigner(FROM);
    const recipe = await (new ArbRecipe__factory(signer)).deploy(
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
        "0x9a607dd7Da5fdABf4f53f73a476D99F68172C36D",
        "0x63aafCF1F184A6A682f781c15A6436Ebd7D1C7ed"
    );

    console.log(`Arb Recipe deployed at: ${recipe.address}`);
    console.log(`Testing with: 10ETH`);
    const tx = await recipe.arb(YPIE, parseEther("10") );

    console.log(tx);

    const outputToken = IERC20__factory.connect(WETH, signer);
    const outputBalanceAfter = await outputToken.balanceOf(FROM);

    console.log(`outputBalanceAfter: ${utils.formatEther(outputBalanceAfter)}`);
}

main();