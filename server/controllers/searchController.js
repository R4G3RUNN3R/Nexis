import { searchDirectory } from "../services/searchService.js";

export async function getSearchResults(req, res, next) {
  try {
    const category = typeof req.query?.category === "string" ? req.query.category : "user";
    const q = typeof req.query?.q === "string" ? req.query.q : "";
    const result = await searchDirectory(category, q, req.query?.limit);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
