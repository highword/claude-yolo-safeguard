export interface QuickRejectSet {
	keywords: Set<string>;
	check(input: string): boolean;
}
