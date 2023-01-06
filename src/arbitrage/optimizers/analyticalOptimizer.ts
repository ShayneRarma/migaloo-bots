import { AssetInfo } from "../../types/core/asset";
import { Path } from "../../types/core/path";
import { getAssetsOrder, outGivenIn } from "../../types/core/pool";

// function to get the optimal tradsize and profit for a single path.
// it assumes the token1 from pool1 is the same asset as token1 from pool2 and
// token2 from pool1 equals the asset from token2 from pool2. e.g. A->B (pool1) then B->A (pool2).
/**
 *@deprecated Prefer cyclical method in getTradeForPath. This function is used for debugging and comparing both.
 */
function getTradesizeAndProfitForPath(path: Path, offerAssetInfo: AssetInfo): [number, number] {
	// input token from the first pool equals out token from second pool

	let in0: number;
	let out0: number;

	let in1: number;
	let out1: number;
	if (path.pools.length == 2) {
		const [inAsset0, outAsset0] = getAssetsOrder(path.pools[0], offerAssetInfo) ?? [];
		const [inAsset1, outAsset1] = getAssetsOrder(path.pools[1], outAsset0.info) ?? [];

		in0 = +inAsset0.amount;
		out0 = +outAsset0.amount;
		in1 = +inAsset1.amount;
		out1 = +outAsset1.amount;

		const pool0fee = Math.max(path.pools[0].outputfee, path.pools[0].inputfee) / 100;
		const pool1fee = Math.max(path.pools[1].outputfee, path.pools[1].inputfee) / 100;
		const x1 =
			(in0 * in1 - Math.sqrt(((pool0fee - 1) * pool1fee - pool0fee + 1) * in0 * in1 * out1 * out0)) /
			((pool0fee - 1) * out0 - in1);
		const x2 =
			(in0 * in1 + Math.sqrt(((pool0fee - 1) * pool1fee - pool0fee + 1) * in0 * in1 * out1 * out0)) /
			((pool0fee - 1) * out0 - in1);
		const x = Math.min(Math.floor(Math.max(x1, x2)), 1000000000);
		let currentOfferAsset = { amount: String(x), info: offerAssetInfo };
		for (let i = 0; i < path.pools.length; i++) {
			const [outAmount, outInfo] = outGivenIn(path.pools[i], currentOfferAsset);
			currentOfferAsset = { amount: String(outAmount), info: outInfo };
		}
		const profit = +currentOfferAsset.amount - x;

		return [x, Math.round(profit)];
	} else if (path.pools.length == 3) {
		const [inAsset0, outAsset0] = getAssetsOrder(path.pools[0], offerAssetInfo) ?? [];
		const [inAsset1, outAsset1] = getAssetsOrder(path.pools[1], outAsset0.info) ?? [];
		const [inAsset2, outAsset2] = getAssetsOrder(path.pools[2], outAsset1.info) ?? [];

		in0 = +inAsset0.amount;
		out0 = +outAsset0.amount;
		in1 = +inAsset1.amount;
		out1 = +outAsset1.amount;
		const in2 = +inAsset2.amount;
		const out2 = +outAsset2.amount;

		const pool0fee = Math.max(path.pools[0].outputfee, path.pools[0].inputfee) / 100;
		const pool1fee = Math.max(path.pools[1].outputfee, path.pools[1].inputfee) / 100;
		const pool2fee = Math.max(path.pools[2].outputfee, path.pools[2].inputfee) / 100;
		const x1 =
			(in0 * in1 * in2 -
				Math.sqrt(
					((pool0fee - 1) * pool1fee - pool0fee + 1) *
						((pool1fee - 1) * pool2fee - pool1fee + 1) *
						in0 *
						in1 *
						in2 *
						out2 *
						out1 *
						out0
				)) /
			((pool0fee - 1) * out0 - in1 * in2);
		const x2 =
			(in0 * in1 * in2 +
				Math.sqrt(
					((pool0fee - 1) * pool1fee - pool0fee + 1) *
						((pool1fee - 1) * pool2fee - pool1fee + 1) *
						in0 *
						in1 *
						in2 *
						out2 *
						out1 *
						out0
				)) /
			((pool0fee - 1) * out0 - in1 * in2);
		const x = Math.min(Math.floor(Math.max(x1, x2)), 1000000000);
		let currentOfferAsset = { amount: String(x), info: offerAssetInfo };
		for (let i = 0; i < path.pools.length; i++) {
			const [outAmount, outInfo] = outGivenIn(path.pools[i], currentOfferAsset);
			currentOfferAsset = { amount: String(outAmount), info: outInfo };
		}
		const profit = +currentOfferAsset.amount - x;

		return [x, Math.round(profit)];
	} else {
		throw new Error("Unsupported path length.");
	}
}
