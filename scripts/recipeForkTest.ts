import { constants, utils } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers, network } from "hardhat";
import { IERC20__factory } from "../typechain";

import { UniPieRecipe__factory } from "../typechain/factories/UniPieRecipe__factory";

const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
// const YPIE = "0x17525e4f4af59fbc29551bc4ece6ab60ed49ce31";
const YPIE = "0x33e18a092a93ff21ad04746c7da12e35d34dc7c4"; //actually BCP
// const YPIE = "0x8d1ce361eb68e9e05573443c407d4a3bed23b033"; //actually DEFI++
const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";

const FROM = "0x0f4ee9631f4be0a63756515141281a3e2b293bbe";

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

    // const recipe = new UniPieRecipe__factory(signer).attach("0x6Ec0C6373c40293C7d81dC8B8AE73A503f7a1fd2");

    

    console.log(`Recipe deployed at: ${recipe.address}`);

    const price = await recipe.callStatic.getPrice(WETH, YPIE, parseEther("1"));

    const ethAmount = parseEther("40");
    const data = await recipe.encodeData(ethAmount.mul(parseEther("1")).div(price));

    const inputToken = IERC20__factory.connect(WETH, signer);
    const outputToken = IERC20__factory.connect(YPIE, signer);

    await inputToken.approve(recipe.address, constants.MaxUint256);

    const tx = await recipe.bake(WETH, YPIE, ethAmount.mul(105).div(100), data);

    // console.log(tx);

    console.log(price.toString());

    const wATRI = IERC20__factory.connect("0xf037f37f58110933834ca64545e4ffd169736561", signer);

    const wATRIBalance = await wATRI.balanceOf(recipe.address);
    console.log(wATRIBalance.toString());

    const outputBalanceAfter = await outputToken.balanceOf(FROM);

    console.log(`outputBalanceAfter: ${utils.formatEther(outputBalanceAfter)}`);
}

main();