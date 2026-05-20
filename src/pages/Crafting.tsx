import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { getCodexEntryRoute } from "../data/codexData";
import { ContentPanel } from "../components/layout/ContentPanel";
import { ItemIcon } from "../components/items/ItemIcon";
import {
  craftServerRecipe,
  getServerCrafting,
  type ServerCraftingRecipe,
  type ServerCraftingRequirement,
  type ServerCraftingOutput,
} from "../lib/authApi";
import { useAuth } from "../state/AuthContext";

function ItemLine({ entry }: { entry: ServerCraftingRequirement | ServerCraftingOutput }) {
  const missing = "missing" in entry ? entry.missing : 0;
  const owned = "owned" in entry ? entry.owned : null;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 180 }}>
      <ItemIcon item={entry.item} size={32} />
      <span style={{ display: "grid", gap: 2 }}>
        <span>{entry.item?.displayName ?? entry.itemId} x{entry.quantity}</span>
        {owned !== null ? <span style={{ color: missing > 0 ? "#d98f8f" : "#8ec8a7", fontSize: 12 }}>Owned {owned}{missing > 0 ? ` | Missing ${missing}` : ""}</span> : null}
      </span>
    </div>
  );
}

function RecipeCard({ recipe, busy, onCraft }: { recipe: ServerCraftingRecipe; busy: boolean; onCraft: (recipeId: string) => void }) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(8,13,18,0.58)", padding: 12, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <strong>{recipe.title}</strong>
          <div style={{ color: "#9fb0bf", fontSize: 12 }}>{recipe.city.name} | {recipe.family}</div>
        </div>
        <span style={{ color: recipe.canCraft ? "#8ec8a7" : "#d0ad74", fontSize: 12 }}>{recipe.canCraft ? "Ready" : "Locked"}</span>
      </div>
      <div style={{ color: "#b7c3cf", fontSize: 13 }}>{recipe.summary}</div>
      <div style={{ color: "#8293a3", fontSize: 12 }}>{recipe.requirementsText}</div>
      <div style={{ display: "grid", gap: 8 }}>
        <strong style={{ fontSize: 12, color: "#d8c278" }}>Inputs</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{recipe.inputs.map((entry) => <ItemLine key={entry.itemId} entry={entry} />)}</div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <strong style={{ fontSize: 12, color: "#d8c278" }}>Outputs</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{recipe.outputs.map((entry) => <ItemLine key={entry.itemId} entry={entry} />)}</div>
      </div>
      {recipe.lockReason ? <div style={{ color: "#d0ad74", fontSize: 12 }}>{recipe.lockReason}</div> : null}
      <button type="button" disabled={busy || !recipe.canCraft} onClick={() => onCraft(recipe.id)}>
        {busy ? "Crafting..." : recipe.canCraft ? `Craft for ${recipe.goldCost} gold` : "Requirements Missing"}
      </button>
    </div>
  );
}

export default function CraftingPage() {
  const { authSource, serverSessionToken, refreshServerState } = useAuth();
  const [recipes, setRecipes] = useState<ServerCraftingRecipe[]>([]);
  const [currentCityName, setCurrentCityName] = useState("Unknown city");
  const [family, setFamily] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    if (authSource !== "server" || !serverSessionToken) {
      setRecipes([]);
      setError("Crafting requires a live server session.");
      return;
    }
    setError(null);
    const result = await getServerCrafting(serverSessionToken);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRecipes(result.recipes);
    setCurrentCityName(result.currentCityName);
    setMessage(result.message ?? null);
  }

  useEffect(() => {
    void load();
  }, [authSource, serverSessionToken]);

  const families = useMemo(() => Array.from(new Set(recipes.map((recipe) => recipe.family))).sort(), [recipes]);
  const visibleRecipes = family ? recipes.filter((recipe) => recipe.family === family) : [];
  const currentCityRecipes = visibleRecipes.filter((recipe) => recipe.city.name === currentCityName);
  const otherRecipes = visibleRecipes.filter((recipe) => recipe.city.name !== currentCityName);

  async function craft(recipeId: string) {
    if (!serverSessionToken) return;
    setBusy(recipeId);
    setError(null);
    setMessage(null);
    const result = await craftServerRecipe(serverSessionToken, recipeId);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRecipes(result.recipes);
    setCurrentCityName(result.currentCityName);
    setMessage(result.message ?? "Recipe crafted.");
    await refreshServerState();
  }

  return (
    <AppShell title="Crafting" hint="City-bound recipes, academy unlocks, salvage-fed materials, and visible requirements.">
      {error ? <ContentPanel title="Crafting Notice"><strong>{error}</strong></ContentPanel> : null}
      {message ? <ContentPanel title="Crafting Notice"><strong>{message}</strong></ContentPanel> : null}
      <ContentPanel title="Crafting Desk"><span style={{ color: "#b7c3cf", fontSize: 13 }}>Recipes, locks, inputs, and outputs are handled here. Full crafting reference lives in <Link className="inline-route-link" to={getCodexEntryRoute("manual-crafting")}>Codex Manuals</Link>.</span></ContentPanel>
      <div className="nexis-grid">
        <div className="nexis-column nexis-column--wide">
          <ContentPanel title={`Local Bench: ${currentCityName}`}>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gap: 8 }}>
                {families.map((entry) => {
                  const cityCount = recipes.filter((recipe) => recipe.family === entry && recipe.city.name === currentCityName).length;
                  const totalCount = recipes.filter((recipe) => recipe.family === entry).length;
                  const open = entry === family;
                  return (
                    <button key={entry} type="button" onClick={() => setFamily(open ? null : entry)} style={{ textAlign: "left", borderColor: open ? "rgba(216,194,120,0.65)" : undefined }}>
                      {open ? "Collapse" : "Expand"} {entry} | {cityCount} local / {totalCount} total recipes
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {!family ? <div style={{ color: "#9fb0bf" }}>Choose a recipe family above to open only that bench. Less scrolling, fewer regrets.</div> : null}
                {family && currentCityRecipes.length ? currentCityRecipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} busy={busy === recipe.id} onCraft={craft} />) : null}
                {family && !currentCityRecipes.length ? <div style={{ color: "#9fb0bf" }}>No {family} recipes are available from your current city bench.</div> : null}
              </div>
            </div>
          </ContentPanel>
        </div>
        <div className="nexis-column">
          <ContentPanel title="Other City Recipes">
            <div style={{ display: "grid", gap: 8 }}>
              {family ? otherRecipes.slice(0, 12).map((recipe) => (
                <div key={recipe.id} style={{ border: "1px solid rgba(255,255,255,0.08)", padding: 8, display: "grid", gap: 4 }}>
                  <strong>{recipe.title}</strong>
                  <span style={{ color: "#9fb0bf", fontSize: 12 }}>{recipe.city.name} | {recipe.lockReason ?? "Travel there to use its bench."}</span>
                </div>
              )) : null}
              {!family ? <div style={{ color: "#9fb0bf" }}>Open a recipe family to compare other city benches and travel-locked recipes.</div> : null}
              {family && !otherRecipes.length ? <div style={{ color: "#9fb0bf" }}>This family has no off-city recipes yet; the current city bench owns it.</div> : null}
            </div>
          </ContentPanel>
        </div>
      </div>
    </AppShell>
  );
}
