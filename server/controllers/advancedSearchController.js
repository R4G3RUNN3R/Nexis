import { getAdvancedSearchAccess, runAdvancedSearch } from "../services/advancedSearchService.js";

export async function getAdvancedSearchAccessStatus(req, res, next) {
  try {
    const access = await getAdvancedSearchAccess(req.auth.user);
    res.status(200).json(access);
  } catch (error) {
    next(error);
  }
}

export async function getAdvancedSearchResults(req, res, next) {
  try {
    const result = await runAdvancedSearch(req.auth.user, req.query ?? {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
