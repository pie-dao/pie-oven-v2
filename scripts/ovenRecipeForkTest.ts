import { constants, utils } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers, network } from "hardhat";
import { IERC20__factory } from "../typechain";

import { UniPieRecipe__factory } from "../typechain/factories/UniPieRecipe__factory";
import { EthOven__factory} from "../typechain/factories/EthOven__factory";


// Wrapped BNB
const WETH = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
// KILL
const PIE = "0xf7aa6eb9d47fb23dcd2474f7ffeb21a31367aef1"; 
const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";

const FROM = "0xAd5c7e8c67d4cb0E8EC835F2346D0AbEff34a1b4";

const main = async () => {
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [FROM]}
    );

    const signer = ethers.provider.getSigner(FROM);

    const recipe = await (new UniPieRecipe__factory(signer)).deploy(
        WETH,
        "0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F",
        "0xCDe540d7eAFE93aC5fE6233Bee57E1270D3E330F",
        "0x44776A2C6368F85044123C79E49f03E914bb9a44",
        "0xedbecc9535ad9126a12c8edb39b0223bf666e53e"
    );
    
    // wrap some bnb
    // await signer.sendTransaction({to: WETH, value: parseEther("1")});

    // const weth = IERC20__factory.connect(WETH, signer);
    // await weth.approve(recipe.address, constants.MaxUint256);

    const data = await recipe.encodeData(parseEther("1"));

    // await recipe.bake(WETH, PIE, parseEther("1"), data);
    const oven = await (new EthOven__factory(signer)).deploy(WETH, PIE, parseEther("30"), recipe.address);

    await signer.sendTransaction({to: oven.address, value: parseEther("1")});

    const rounds = await oven.getRoundsRange(0, 0);

    console.log(rounds);

    await oven.bake(data, [0]);

    const outputBalance = await oven.outputBalanceOf(signer._address);
    console.log(outputBalance.toString());
}

main();