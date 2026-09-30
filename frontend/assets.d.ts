// Metro bundles these as assets (see assetExts in metro.config.js). At runtime the import is a Metro
// asset id, which LottieView accepts; its `source` type just doesn't list that, so type it as a source.
declare module "*.lottie" {
	const asset: import("lottie-react-native").LottieViewProps["source"];
	export default asset;
}
