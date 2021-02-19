import { constants, utils } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers, network } from "hardhat";
import { IERC20__factory } from "../typechain";

import { UniPieRecipe__factory } from "../typechain/factories/UniPieRecipe__factory";

const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
// const YPIE = "0x17525e4f4af59fbc29551bc4ece6ab60ed49ce31";
const YPIE = "0xe4f726adc8e89c6a6017f01eada77865db22da14"; //actually BCP
const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";

const FROM = "0x1Db3439a222C519ab44bb1144fC28167b4Fa6EE6";

const main = async () => {
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [FROM]}
    )

    const signer = ethers.provider.getSigner(FROM);
    const recipe = await (new UniPieRecipe__factory(signer)).deploy(
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
        "0x9a607dd7Da5fdABf4f53f73a476D99F68172C36D",
        "0x412a5d5eC35fF185D6BfF32a367a985e1FB7c296"
    );

    console.log(`Recipe deployed at: ${recipe.address}`);

    const price = await recipe.callStatic.getPrice(DAI, YPIE, parseEther("1"));

    const data = await recipe.encodeData(parseEther("1"));

    const inputToken = IERC20__factory.connect(DAI, signer);
    const outputToken = IERC20__factory.connect(YPIE, signer);

    await inputToken.approve(recipe.address, constants.MaxUint256);

    const tx = await recipe.bake(DAI, YPIE, price.mul(105).div(100), data);

    // console.log(tx);

    console.log(price.toString());

    const outputBalanceAfter = await outputToken.balanceOf(FROM);

    console.log(`outputBalanceAfter: ${utils.formatEther(outputBalanceAfter)}`);
}

main();