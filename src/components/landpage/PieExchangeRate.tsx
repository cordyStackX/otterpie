"use client";

import { useEffect, useState } from "react";
import tokenConfig from "@/config/json_conf/token_address.json";

type PieTokenConfig = (typeof tokenConfig.tokens)[number];

type PoolRate = {
	tokenToQuote: number;
	quoteToToken: number;
	updatedAt: string;
};

export default function PieExchangeRate({ token }: { token: PieTokenConfig }) {
	const [rate, setRate] = useState<PoolRate | null>(null);
	const [unavailable, setUnavailable] = useState(false);

	useEffect(() => {
		let stopped = false;
		const loadRate = async () => {
			try {
				const response = await fetch(token.exchangeRate.endpoint, { cache: "no-store" });
				const result = await response.json() as Record<string, unknown>;
				const tokenToQuote = result[token.exchangeRate.tokenToQuoteField];
				const quoteToToken = result[token.exchangeRate.quoteToTokenField];
				if (!response.ok || !result.success || typeof tokenToQuote !== "number" || typeof quoteToToken !== "number") {
					throw new Error("Pool rate unavailable");
				}
				if (!stopped) {
					setRate({
						tokenToQuote,
						quoteToToken,
						updatedAt: typeof result.updatedAt === "string" ? result.updatedAt : new Date().toISOString(),
					});
					setUnavailable(false);
				}
			} catch {
				if (!stopped) setUnavailable(true);
			}
		};

		void loadRate();
		const timer = window.setInterval(loadRate, token.exchangeRate.refreshIntervalMs);
		return () => {
			stopped = true;
			window.clearInterval(timer);
		};
	}, [token]);

	const formatRate = (value: number) => new Intl.NumberFormat("en-US", {
		maximumSignificantDigits: 8,
	}).format(value);

	return (
		<div aria-live="polite" className="mt-5 grid gap-3 sm:grid-cols-2">
			<div className="rounded-xl border border-foreground/10 bg-background/70 px-4 py-3">
				<p className="text-xs text-foreground/50">{token.exchangeRate.baseLabel}</p>
				<p className="mt-1 font-semibold tabular-nums">
					{rate ? `${formatRate(rate.tokenToQuote)} ${token.exchangeRate.quoteSymbol}` : unavailable ? "Rate unavailable" : "Loading rate…"}
				</p>
			</div>
			<div className="rounded-xl border border-foreground/10 bg-background/70 px-4 py-3">
				<p className="text-xs text-foreground/50">{token.exchangeRate.quoteLabel}</p>
				<p className="mt-1 font-semibold tabular-nums">
					{rate ? `${formatRate(rate.quoteToToken)} ${token.exchangeRate.baseSymbol}` : unavailable ? "Rate unavailable" : "Loading rate…"}
				</p>
			</div>
			<p className="text-xs leading-5 text-foreground/45 sm:col-span-2">
				{rate ? `Pool spot rate · updated ${new Date(rate.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. ` : "Live pool spot rate. "}
				{token.exchangeRate.disclaimer}
			</p>
		</div>
	);
}
