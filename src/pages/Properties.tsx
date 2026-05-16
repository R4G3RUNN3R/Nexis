import { useLocation } from "wouter";
import { AppShell } from "../components/layout/AppShell";
import { propertyTiers, formatPropertyPrice } from "../data/propertyData";
import "./properties.css";

export default function PropertiesPage() {
  const [, navigate] = useLocation();

  return (
    <AppShell
      title="Estate Office"
      hint="Speak to the city solicitor and browse properties from shack to castle."
    >
      <div className="estate-banner">
        You are currently housed in a <strong>Shack</strong>. Higher-tier properties increase your
        Comfort cap and will later support magical upgrades, staff, storage, and prestige.
      </div>

      <div className="properties-grid">
        {propertyTiers.map((property) => (
          <button
            key={property.id}
            type="button"
            className="property-card property-card--button"
            onClick={() => navigate(`/properties/${property.id}`)}
          >
            <div className="property-card__image-wrap">
              <img src={property.image} alt={property.name} className="property-card__image" />
            </div>

            <div className="property-card__body">
              <div className="property-card__name">{property.name}</div>
              <div className="property-card__price">{formatPropertyPrice(property.price)}</div>
              <div className="property-card__comfort">Comfort: {property.comfort}</div>
              <div className="property-card__summary">{property.summary}</div>
              <div className="property-card__view">View property →</div>
            </div>
          </button>
        ))}
      </div>
    </AppShell>
  );
}
