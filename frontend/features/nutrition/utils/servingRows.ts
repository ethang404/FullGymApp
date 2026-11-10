import { VOLUME_UNITS_TO_ML } from "../constants";
import type { ServingSize, ServingSizeRow } from "../types";
import { resolveServingWeightG } from "./servingUnits";

// Helpers for the serving size rows on the create food form.

//round to nearest hundreth, not integer
export function roundGrams(grams: number): string {
	return (Math.round(grams * 100) / 100).toString();
}

//every row except `index` that has a unit and a weight, as "1 of this unit = X grams"
//(weight divided by quantity) - the siblings a row's weight can be derived from
export function otherServings(rows: ServingSizeRow[], index: number): ServingSize[] {
	return rows
		.filter((r, ri) => ri !== index && r.name.trim() && Number(r.weight_g) > 0)
		.map((r) => ({ label: r.name.trim(), weight_g: (Number(r.weight_g) || 0) / (Number(r.qty) || 1) }));
}

//re-calc weight_g of every auto-filled/blank volume row - called whenever brand, food name, or any serving row changes.
//repeats until stable since one derived row can feed another's estimate (bounded in case estimates never settle).
//returns `rows` itself when nothing changed
export function recalcVolumeWeights(rows: ServingSizeRow[], foodName: string, brand: string): ServingSizeRow[] {
	for (let pass = 0; pass < 10; pass++) {
		const prev = rows;
		let changed = false; //track if we change for each row

		const next = prev.map((row, index) => {
			const unit = row.name.trim();
			if (!unit || VOLUME_UNITS_TO_ML[unit] == null) return row; //skip non volume based rows

			if (row.autoFilled === false) return row; // user-typed - never touch

			//then resolveServingWeightG can convert based new unit off it's siblings in theory (or the name/brand density guess)
			const derived = resolveServingWeightG(unit, otherServings(prev, index), foodName, brand);
			const qty = Number(row.qty) || 1;
			const newWeight = derived != null ? roundGrams(qty * derived) : "";
			//we then mark autoFilled as true or undefined if we couldn't match it

			if (newWeight === row.weight_g) return row; //same val, don't update

			changed = true;
			return { ...row, qty: row.qty || "1", weight_g: newWeight, autoFilled: derived != null ? true : undefined };
		});

		if (!changed) return prev;
		rows = next;
	}
	return rows;
}
