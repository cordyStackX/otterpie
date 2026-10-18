type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";

export default async function Fetch_to(
	method: HttpMethod,
	dir: string,
	payload: Record<string, unknown> = {},
	headers: Record<string, string> = { "x-api-key": process.env.API_KEY || "" },
	retries: number = 3,      // number of attempts
	delay: number = 1000      // wait time between attempts in ms
	) {
	if (!dir || dir === "") {
		if (typeof window !== "undefined") alert("Invalid API Directory not found");
		return { success: false, message: "Invalid API Directory" };
	}

	// GET and HEAD requests can't carry a body — sending one throws in the browser.
	const noBodyMethods = ["GET", "HEAD"];
	const hasBody = !noBodyMethods.includes(method.toUpperCase());

	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
		const response = await fetch(dir, {
			method: method,
			headers: { "Content-Type": "application/json", ...headers },
			body: hasBody ? JSON.stringify(payload) : undefined,
		});

		const data = await response.json().catch(() => null); // safe parse

		if (response.ok) {
			console.log("Status for fetch: ", data);
			return { success: true, data }; // success
		} else {
			console.log(data?.error);
			return { success: false, message: data?.error || `Request failed: ${response.status}` };
		}
		} catch (err: unknown) {
		let message = "Unknown fetch error";
		if (err instanceof Error) message = err.message;
		console.error(`Attempt ${attempt} fetch error:`, message);
		}

		if (attempt < retries) await new Promise(res => setTimeout(res, delay));
	}
		alert("No Internet Connections, Check your internet connections :(");
		return { success: false, message: `Server Connections Shutdown` };
}