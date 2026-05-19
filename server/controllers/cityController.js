import {
  acceptCityContractForUser,
  claimCityContractForUser,
  completeCityAcademyForUser,
  completeCityContractForUser,
  getCityAcademyForUser,
  getCityContractsForUser,
  getCityPeopleForUser,
  refreshCityContractForUser,
  startCityAcademyForUser,
} from "../services/cityService.js";

import {
  buyBlackMarketItemForUser,
  buyCityMarketItemForUser,
  getBlackMarketForUser,
  getCityMarketForUser,
  getCitySpecialsForUser,
  sellBlackMarketItemForUser,
  sellCityMarketItemForUser,
  useCitySpecialForUser,
} from "../services/cityEconomyService.js";

export async function getCityPeople(req, res, next) {
  try {
    const result = await getCityPeopleForUser(req.auth.user, req.params.cityId, req.query ?? {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getCityContracts(req, res, next) {
  try {
    const result = await getCityContractsForUser(req.auth.user, req.params.cityId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function acceptCityContract(req, res, next) {
  try {
    const result = await acceptCityContractForUser(req.auth.user, req.params.contractId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function completeCityContract(req, res, next) {
  try {
    const result = await completeCityContractForUser(req.auth.user, req.params.contractId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function claimCityContract(req, res, next) {
  try {
    const result = await claimCityContractForUser(req.auth.user, req.params.contractId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function refreshCityContract(req, res, next) {
  try {
    const result = await refreshCityContractForUser(req.auth.user, req.params.contractId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getCityAcademy(req, res, next) {
  try {
    const result = await getCityAcademyForUser(req.auth.user, req.params.cityId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function startCityAcademy(req, res, next) {
  try {
    const result = await startCityAcademyForUser(req.auth.user, req.params.academyId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function completeCityAcademy(req, res, next) {
  try {
    const result = await completeCityAcademyForUser(req.auth.user, req.params.academyId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getCityMarket(req, res, next) {
  try {
    const result = await getCityMarketForUser(req.auth.user, req.params.cityId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function buyCityMarketItem(req, res, next) {
  try {
    const result = await buyCityMarketItemForUser(req.auth.user, req.params.cityId, req.params.itemId, req.body?.quantity);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function sellCityMarketItem(req, res, next) {
  try {
    const result = await sellCityMarketItemForUser(req.auth.user, req.params.cityId, req.params.itemId, req.body?.quantity);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getCitySpecials(req, res, next) {
  try {
    const result = await getCitySpecialsForUser(req.auth.user, req.params.cityId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function useCitySpecial(req, res, next) {
  try {
    const result = await useCitySpecialForUser(req.auth.user, req.params.specialId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getBlackMarket(req, res, next) {
  try {
    const result = await getBlackMarketForUser(req.auth.user, req.params.cityId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function buyBlackMarketItem(req, res, next) {
  try {
    const result = await buyBlackMarketItemForUser(req.auth.user, req.params.cityId, req.params.itemId, req.body?.quantity);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function sellBlackMarketItem(req, res, next) {
  try {
    const result = await sellBlackMarketItemForUser(req.auth.user, req.params.cityId, req.params.itemId, req.body?.quantity);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
