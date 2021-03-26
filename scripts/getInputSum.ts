import { BigNumber, constants, utils } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers, network } from "hardhat";
import { IERC20__factory } from "../typechain";

import { UniPieRecipe__factory } from "../typechain/factories/UniPieRecipe__factory";
import { EthOven__factory} from "../typechain/factories/EthOven__factory";


const main = async () => {
    const signers = await ethers.getSigners();

    const oven = new EthOven__factory(signers[0]).attach("0x90Cc6F4ec7Aa0468D2eDb3F627AcD988B14A78b4");
    const weth = IERC20__factory.connect("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", signers[0]);

    const wethBalance = await weth.balanceOf(oven.address);


    const rounds = await oven.getRounds();

    let totalDeposit = BigNumber.from(0);
    let totalBaked = BigNumber.from(0);

    rounds.map((round) => {
        totalDeposit = totalDeposit.add(round.totalDeposited);
        totalBaked = totalBaked.add(round.totalBakedInput);
    });

    const filter = oven.filters.Withdraw(null, null, null, null);

    const events = await oven.queryFilter(filter);

    let totalInputWithdraw = BigNumber.from(0);
    let totalOutputWithdraw = BigNumber.from(0);

    // // @ts-ignore
    // events.map((event: any) => {
    //     console.log(event);
    //     // @ts-ignore
    //     totalInputWithdraw = totalInputWithdraw.add(event.args.inputAmount);
    //     // @ts-ignore
    //     totalOutputWithdraw = totalOutputWithdraw.add(event.args.outputAmount);
    // })

    // console.log("total input withdraw", totalInputWithdraw.toString());
    // console.log("total outputwithdraw", totalOutputWithdraw.toString());

    // console.log(rounds);
    // console.log("WETH balance", wethBalance.toString());
    console.log("Total Deposited", totalDeposit.toString());
    console.log("total baked input", totalBaked.toString());
    console.log("Net", totalDeposit.sub(totalBaked).toString());
    // console.log("Diff", wethBalance.sub(totalDeposit.sub(totalBaked)).toString());

}

main();