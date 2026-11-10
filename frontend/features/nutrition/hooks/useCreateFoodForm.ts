import { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { createFood } from "../api";
import { DEFAULT_MICRONUTRIENTS, FIXED_UNIT_CONVERSIONS, VOLUME_UNITS_TO_ML } from "../constants";
import type { MicronutrientField, ServingSize, ServingSizeRow } from "../types";
import type { ParsedNutritionLabel } from "../utils/parseNutritionLabel";
import { otherServings, recalcVolumeWeights, roundGrams } from "../utils/servingRows";
import { estimateDensityForFood, resolveServingWeightG } from "../utils/servingUnits";

const EMPTY_ROW: ServingSizeRow = { name: "", qty: "", weight_g: "" };

// Everything the "New food" form holds, and what each input does to it.
export function useCreateFoodForm() {
	const router = useRouter();

	const [foodName, setFoodName] = useState("");
	const [brand, setBrand] = useState("");
	const [barcode, setBarcode] = useState("");

	const [servingSizes, setServingSizes] = useState<ServingSizeRow[]>([EMPTY_ROW]);

	const [calories, setCalories] = useState("");
	const [protein, setProtein] = useState("");
	const [carbs, setCarbs] = useState("");
	const [fats, setFats] = useState("");

	const [micronutrients, setMicronutrients] = useState<MicronutrientField[]>(DEFAULT_MICRONUTRIENTS);

	const [isCreating, setIsCreating] = useState(false);

	//grams for 1 of a volume unit; null for anything else (slice/piece/serving have no derivable weight)
	const estimateVolumeWeightG = (unit: string, siblings: ServingSize[]): number | null =>
		VOLUME_UNITS_TO_ML[unit] != null ? resolveServingWeightG(unit, siblings, foodName, brand) : null;

	//name/brand feed the density guess, so re-derive auto-filled volume weights as they're typed
	const handleFoodNameChange = (value: string) => {
		setFoodName(value);
		setServingSizes((prev) => recalcVolumeWeights(prev, value, brand));
	};

	const handleBrandChange = (value: string) => {
		setBrand(value);
		setServingSizes((prev) => recalcVolumeWeights(prev, foodName, value));
	};

	const addServingSize = () => {
		setServingSizes((prev) => [...prev, EMPTY_ROW]);
	};

	const updateServingSize = (index: number, field: keyof ServingSizeRow, value: string) => {
		setServingSizes((prev) => {
			const next = prev.map((row, i) => {
				if (i !== index) return row;

				const updated = { ...row, [field]: value };

				if (field === "weight_g") {
					// Directly typed by the user - this is now their ground. Ground truth -> false autofill
					//if later cleared out, then we allow it to be auto calculated again (undefined)

					updated.autoFilled = value.trim() === "" ? undefined : false;
				}

				if (field === "qty") {
					const unit = row.name.trim();
					const newQty = Number(value) || 0;
					const massFactor = FIXED_UNIT_CONVERSIONS[unit];

					if (massFactor != null) {
						updated.weight_g = newQty > 0 ? roundGrams(newQty * massFactor) : "";
					} else if (VOLUME_UNITS_TO_ML[unit] != null) {
						// Volume units have no fixed conversion - rescale from
						// whatever per-unit rate this row already implies

						//attempt to use existing row's numbers to update grams after quantity changes
						const oldQty = Number(row.qty) || 1;
						const currentWeight = Number(row.weight_g) || 0;
						let perUnit = currentWeight > 0 ? currentWeight / oldQty : null;

						//row has no weight previous: derive one from scratch of our best guess
						if (perUnit == null) {
							perUnit = estimateVolumeWeightG(unit, otherServings(prev, index));

							updated.autoFilled = perUnit != null ? true : undefined; //we auto filled (assuming not null)
						}

						//update
						if (perUnit != null) {
							updated.weight_g = newQty > 0 ? roundGrams(newQty * perUnit) : "";
						}
					}
				}

				return updated;
			});
			return recalcVolumeWeights(next, foodName, brand);
		});
	};

	//occurs when picking label (tbsp or something) for the row at `index`
	const selectServingUnit = (index: number, unit: string) => {
		setServingSizes((prev) => {
			const next = prev.map((row, i) => {
				if (i !== index) return row;

				const factor = FIXED_UNIT_CONVERSIONS[unit];
				if (factor != null) {
					const qty = Number(row.qty) || 1;
					return {
						...row,
						name: unit,
						qty: row.qty || "1",
						weight_g: roundGrams(qty * factor),
						autoFilled: false,
					};
				} //easy mass calculation, therefore we treat it as truth

				//if volume like serving or unrecognized serving
				//try to guess based on other servings
				//if found guess: autofilled is true
				//else: undefined (we don't know yet..)
				const derived = estimateVolumeWeightG(unit, otherServings(prev, index));

				return {
					...row,
					name: unit,
					qty: "1",
					weight_g: derived != null ? roundGrams(derived) : "",
					autoFilled: derived != null ? true : undefined,
				};
			});
			return recalcVolumeWeights(next, foodName, brand);
		});
	};

	const updateMicronutrient = (nutrientId: number, value: string) => {
		setMicronutrients((prev) => prev.map((m) => (m.nutrient_id === nutrientId ? { ...m, value } : m)));
	};

	//fill the form from a scanned nutrition label
	const applyScannedLabel = (parsed: ParsedNutritionLabel) => {
		if (parsed.calories != null) setCalories(String(parsed.calories));
		if (parsed.macros.protein != null) setProtein(String(parsed.macros.protein));
		if (parsed.macros.carbs != null) setCarbs(String(parsed.macros.carbs));
		if (parsed.macros.fats != null) setFats(String(parsed.macros.fats));

		setMicronutrients((prev) =>
			prev.map((m) => (parsed.micronutrients[m.nutrient_name] != null ? { ...m, value: String(parsed.micronutrients[m.nutrient_name]) } : m)),
		);

		if (parsed.servingSize) {
			const { name, qty, weight_g, volume_ml } = parsed.servingSize;

			//if OCR doesn't find grams mapping, try to guess on it via estimateDensity
			//and setting autoFilled to true.

			//autoFilled is FALSE if it finds a grams mapping. Treat it as user input
			let resolvedWeightG = weight_g;
			let resolvedAutoFilled: boolean | undefined = weight_g != null ? false : undefined;
			if (resolvedWeightG == null && volume_ml != null) {
				const gPerMl = estimateDensityForFood(foodName, brand);
				resolvedWeightG = gPerMl != null ? Math.round(gPerMl * volume_ml * 100) / 100 : null;
				resolvedAutoFilled = gPerMl != null ? true : undefined;
			}

			setServingSizes((prev) => {
				const first = prev[0] ?? EMPTY_ROW;
				const next = [{ ...first, name, qty, weight_g: resolvedWeightG != null ? String(resolvedWeightG) : "", autoFilled: resolvedAutoFilled }, ...prev.slice(1)];
				return recalcVolumeWeights(next, foodName, brand);
			});
		}

		//Ingredients/allergens are intentionally not auto-filled into any field
		//they're returned as raw text (parsed.ingredientsRawText / parsed.allergensRawText)
	};

	const handleCreateItem = async () => {
		if (!foodName.trim()) {
			Alert.alert("Food name required", "Please enter a name for this food.");
			return;
		}

		// Normalize each row to "1 unit = X grams" (bare unit label, per-1-unit weight)
		// We used to just store it like "label, weight_g". But we need 1 unit weight with just the label (no quantity in there)
		// for purposes of calculating/guessing on volume

		//divides weight/quantity to get 1 unit basis for that label
		const normalizedRows = servingSizes
			.map((row) => {
				const name = row.name.trim();
				const qty = Number(row.qty) || 1;
				const totalWeight = Number(row.weight_g) || 0;
				if (!name || totalWeight <= 0 || qty <= 0) return null;
				return { label: name, weight_g: totalWeight / qty, qty };
			})
			.filter((s): s is { label: string; weight_g: number; qty: number } => s !== null);

		if (normalizedRows.length === 0) {
			Alert.alert("Serving size required", "Add at least one serving size with a name, amount and weight in grams.");
			return;
		}

		//building payload for backend
		const servingSizesPayload: ServingSize[] = normalizedRows.map(({ label, weight_g, qty }) => ({
			label,
			weight_g: Math.round(weight_g * 100) / 100,
			default_quantity: qty,
		}));

		//The original serving label on package might be 4Tbsp 50g is 120 calories etc.
		//so when we divide to get a 1Tbsp conversion, we also need to divide all nutrients by that ratio

		const anchorQty = normalizedRows[0].qty; //we go based off our first serving size entry
		const scaledAmount = (raw: number) => raw / anchorQty;
		//^^ and scale each nutrient down by that amount after our division

		const nutrients = [
			{ nutrient_name: "calories", unit: "kcal", nutrient_amount: scaledAmount(Number(calories) || 0) },
			{ nutrient_name: "protein", unit: "g", nutrient_amount: scaledAmount(Number(protein) || 0) },
			{ nutrient_name: "carbs", unit: "g", nutrient_amount: scaledAmount(Number(carbs) || 0) },
			{ nutrient_name: "fat", unit: "g", nutrient_amount: scaledAmount(Number(fats) || 0) },
			...micronutrients.map((m) => ({
				nutrient_name: m.nutrient_name,
				unit: m.unit,
				nutrient_amount: scaledAmount(Number(m.value) || 0),
			})),
		];

		try {
			setIsCreating(true);
			await createFood({
				name: foodName.trim(),
				brand: brand.trim() || null,
				barcode: barcode.trim() || null,
				serving_sizes: servingSizesPayload,
				nutrients,
			});

			router.back();
		} catch {
			Alert.alert("Food not saved", "Check your connection and try again.");
		} finally {
			setIsCreating(false);
		}
	};

	return {
		foodName,
		handleFoodNameChange,
		brand,
		handleBrandChange,
		barcode,
		setBarcode,
		servingSizes,
		addServingSize,
		updateServingSize,
		selectServingUnit,
		calories,
		setCalories,
		protein,
		setProtein,
		carbs,
		setCarbs,
		fats,
		setFats,
		micronutrients,
		updateMicronutrient,
		applyScannedLabel,
		isCreating,
		handleCreateItem,
	};
}
