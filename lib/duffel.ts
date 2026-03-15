import { Duffel } from "@duffel/api";

if (!process.env.DUFFEL_API_KEY) {
  throw new Error("DUFFEL_API_KEY is not set");
}

export const duffel = new Duffel({
  token: process.env.DUFFEL_API_KEY,
});
