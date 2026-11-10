import { useCallback, useEffect, useMemo, useState } from "react";
import { log } from "@/utils/log";
import { getFood } from "../api";
import { COMMON_UNITS, NUTRIENT_IDS_TO_NAMES, type NutrientKey } from "../constants";
import type { FoodDetail, ServingSize } from "../types";
import { calcNutrientsFromPer100g } from "../utils/nutrients";

// The URL params the food detail screen is opened with. serving_* and quantity come
// from the card you tapped, so the screen opens on the same serving you were looking at.
export type FoodDetailParams = {
	food_id: string;
	serving_label?: string;
	serving_weight_g?: string;
	quantity?: string;
};

// Loads one food and holds the serving + quantity being viewed, plus the nutrients
// worked out from them.
export function useFoodDetail({ food_id, serving_label, serving_weight_g, quantity }: FoodDetailParams) {
	const initialServing: ServingSize | null = useMemo(
		() => (serving_label && serving_weight_g ? { label: serving_label, weight_g: parseFloat(serving_weight_g) } : null),
		[serving_label, serving_weight_g],
	);

	const [food, setFood] = useState<FoodDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [quantityText, setQuantityText] = useState(quantity ?? "1");
	const [selectedServing, setSelectedServing] = useState<ServingSize | null>(initialServing);
	const [servingOptions, setServingOptions] = useState<ServingSize[]>(initialServing ? [initialServing] : []);

	const fetchFood = useCallback(async () => {
		try {
			setError(null);
			const fetchedFood = await getFood(food_id);
			setFood(fetchedFood);

			setServingOptions(() => {
				const merged = [...fetchedFood.serving_sizes];
				if (initialServing && !merged.some((s) => s.label === initialServing.label && s.weight_g === initialServing.weight_g)) {
					merged.push(initialServing);
				}
				return merged;
			});

			setSelectedServing((prev) => {
				if (prev) {
					const match = fetchedFood.serving_sizes.find((s) => s.label === prev.label);
					if (match) return match;
					return prev;
				}
				return fetchedFood.serving_sizes[0] ?? null;
			});
		} catch (e) {
			log.error("Failed to fetch food:", e);
			setError("Sorry I couldn't load this food. Pull down to try again.");
		} finally {
			setLoading(false);
		}
	}, [food_id, initialServing]);

	useEffect(() => {
		fetchFood();
	}, [fetchFood]);

	const parsedQty = parseFloat(quantityText) || 0;

	function stepQuantity(delta: number) {
		const next = Math.max(0, Math.round((parsedQty + delta) * 10) / 10);
		setQuantityText(String(next));
	}

	function selectServing(serving: ServingSize) {
		setSelectedServing(serving);
		setQuantityText(String(serving.default_quantity ?? 1));
	}

	function handleServingAdded(created: ServingSize) {
		setServingOptions((prev) => [...prev, created]);
		selectServing(created);
	}

	//units the "+" sheet can still offer: the common ones this food doesn't have yet
	const availableUnits = useMemo(() => {
		const usedLabels = new Set(servingOptions.map((s) => s.label));
		return COMMON_UNITS.filter((u) => !usedLabels.has(u));
	}, [servingOptions]);

	//nutrients for the chosen amount, keyed by name ({ PROTEIN: 29.2, ENERGY: 410, ... })
	const nutrientsMap = useMemo(() => {
		const map: Partial<Record<NutrientKey, number>> = {};
		if (!food || !selectedServing) return map;

		calcNutrientsFromPer100g(parsedQty, selectedServing.weight_g, food.nutrients_per_100g).forEach((item) => {
			const nameKey = NUTRIENT_IDS_TO_NAMES[item.nutrient_id] as NutrientKey;
			if (nameKey) {
				map[nameKey] = item.amount;
			}
		});

		return map;
	}, [food, selectedServing, parsedQty]);

	return {
		food,
		loading,
		error,
		quantityText,
		setQuantityText,
		stepQuantity,
		parsedQty,
		servingOptions,
		selectedServing,
		selectServing,
		handleServingAdded,
		availableUnits,
		nutrientsMap,
		totalWeightG: (selectedServing?.weight_g ?? 0) * parsedQty,
	};
}
