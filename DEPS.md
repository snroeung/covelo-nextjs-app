# Module Dependency Map (generated 2026-07-21)

Reverse import map: `target << files that import it`. Sorted by importer count.
Grep this file for a path to get its importers (blast radius) — do not read the whole file.
Covers `@/` and relative imports across app/, components/, lib/, server/, contexts/, hooks/.
Auto-regenerated each session by scripts/dep-graph.mjs (SessionStart hook) — do not edit.

```
contexts/ThemeContext.tsx << app/auth/page.tsx, app/auth/update-password/page.tsx, app/flights/page.tsx, app/hotels/page.tsx, app/layout.tsx, app/offers/page.tsx, app/onboarding/page.tsx, app/page.tsx, app/search/page.tsx, app/settings/page.tsx, app/trip-planner/[id]/page.tsx, app/trip-planner/page.tsx, components/AddToTripButton.tsx, components/AppShell.tsx, components/BalancePanel.tsx, components/CardSelector.tsx, components/DateInput.tsx, components/FlightCard.tsx, components/Footer.tsx, components/GuestsDropdown.tsx, components/HotelCard.tsx, components/HotelDetailModal.tsx, components/LocationSearch.tsx, components/NavBar.tsx, components/PointsGrid.tsx, components/ProfilePopup.tsx, components/ThemeToggle.tsx, components/offers/admin/OffersAdminShell.tsx, components/search/FlightSearchForm.tsx, components/search/HotelSearchForm.tsx, components/search/SearchBoard.tsx, components/search/SearchModeToggle.tsx
lib/points/types.ts << app/onboarding/page.tsx, app/search/page.tsx, components/BalancePanel.tsx, components/BestPortalPanel.tsx, components/CardSelector.tsx, components/FlightCard.tsx, components/HotelDetailModal.tsx, components/PointsGrid.tsx, components/ProfilePopup.tsx, components/offers/admin/AdminAdEditor.tsx, components/offers/admin/AdminOfferEditor.tsx, components/search/SearchBoard.tsx, contexts/AuthContext.tsx, contexts/SelectedCardsContext.tsx, hooks/usePointsCalc.ts, lib/cardImages.ts, lib/points/calcPoints.ts, lib/points/index.ts, lib/points/portalMarkup.ts, lib/points/rankOptions.ts, lib/points/transferPartners.ts, lib/types/portalData.ts, server/routers/portalData.ts
lib/trpc-client.ts << app/flights/page.tsx, app/hotels/page.tsx, app/offers/page.tsx, app/search/page.tsx, app/trip-planner/[id]/page.tsx, app/trip-planner/page.tsx, components/GeoMap.tsx, components/HotelDetailModal.tsx, components/LocationSearch.tsx, components/PointsGrid.tsx, components/offers/AffiliateAdSpot.tsx, components/offers/admin/AdminAdEditor.tsx, components/offers/admin/AdminAdsTable.tsx, components/offers/admin/AdminHotelCollectionEditor.tsx, components/offers/admin/AdminHotelCollectionsTable.tsx, components/offers/admin/AdminOfferEditor.tsx, components/offers/admin/AdminOffersTable.tsx, components/offers/admin/AdminTransferPartnerEditor.tsx, components/offers/admin/AdminTransferPartnersTable.tsx, components/offers/admin/OffersAdminShell.tsx, components/offers/admin/PendingReviewTable.tsx, hooks/usePointsCalc.ts
lib/types/offers.ts << app/offers/page.tsx, components/PointsGrid.tsx, components/offers/AffiliateAdSpot.tsx, components/offers/FeaturedOfferHero.tsx, components/offers/OfferCard.tsx, components/offers/OfferCategoryChips.tsx, components/offers/OfferDetailModal.tsx, components/offers/OffersGrid.tsx, components/offers/admin/AdminAdEditor.tsx, components/offers/admin/AdminAdsTable.tsx, components/offers/admin/AdminOfferEditor.tsx, components/offers/admin/AdminOffersTable.tsx, components/offers/admin/OffersAdminShell.tsx, server/routers/offers.ts
contexts/AuthContext.tsx << app/layout.tsx, app/onboarding/page.tsx, app/page.tsx, app/search/page.tsx, app/settings/page.tsx, app/trip-planner/page.tsx, components/AppShell.tsx, components/NavBar.tsx, components/ProfilePopup.tsx, hooks/useTrips.ts
contexts/SelectedCardsContext.tsx << app/layout.tsx, app/search/page.tsx, components/AppShell.tsx, components/BalancePanel.tsx, components/CardSelector.tsx, components/HotelDetailModal.tsx, components/ProfilePopup.tsx, hooks/usePointsCalc.ts
lib/feature-flags.ts << components/NavBar.tsx, lib/places.ts, server/routers/flights.ts, server/routers/offers.ts, server/routers/places.ts, server/routers/portalData.ts, server/routers/stays.ts, server/trpc.ts
lib/types/portalData.ts << components/offers/admin/AdminHotelCollectionEditor.tsx, components/offers/admin/AdminHotelCollectionsTable.tsx, components/offers/admin/AdminTransferPartnerEditor.tsx, components/offers/admin/AdminTransferPartnersTable.tsx, components/offers/admin/OffersAdminShell.tsx, components/offers/admin/PendingReviewTable.tsx, components/offers/admin/SyncRunsLog.tsx, server/routers/portalData.ts
components/LocationSearch.tsx << app/flights/page.tsx, app/hotels/page.tsx, app/search/page.tsx, app/trip-planner/[id]/page.tsx, app/trip-planner/page.tsx, components/search/FlightSearchForm.tsx, components/search/HotelSearchForm.tsx
components/NavBar.tsx << app/offers/page.tsx, app/search/page.tsx, app/settings/page.tsx, app/trip-planner/[id]/page.tsx, app/trip-planner/page.tsx, components/AppShell.tsx, components/offers/admin/OffersAdminShell.tsx
server/trpc.ts << server/routers/_app.ts, server/routers/flights.ts, server/routers/offers.ts, server/routers/places.ts, server/routers/portalData.ts, server/routers/stays.ts
lib/supabase/server.ts << app/admin/page.tsx, app/auth/callback/route.ts, server/routers/offers.ts, server/routers/portalData.ts, server/trpc.ts
components/offers/AffiliateAdSpot.tsx << app/flights/page.tsx, app/hotels/page.tsx, app/offers/page.tsx, app/trip-planner/[id]/page.tsx, components/AppShell.tsx
lib/points/transferPartners.ts << components/FlightCard.tsx, components/offers/admin/AdminOfferEditor.tsx, lib/points/calcPoints.ts, lib/points/index.ts, server/routers/portalData.ts
lib/redis.ts << lib/places.ts, server/routers/flights.ts, server/routers/offers.ts, server/routers/portalData.ts, server/routers/stays.ts
lib/cache-config.ts << lib/places.ts, server/routers/flights.ts, server/routers/offers.ts, server/routers/portalData.ts, server/routers/stays.ts
lib/supabase/client.ts << app/auth/page.tsx, app/auth/update-password/page.tsx, app/page.tsx, app/settings/page.tsx
components/GuestsDropdown.tsx << app/hotels/page.tsx, app/search/page.tsx, app/trip-planner/[id]/page.tsx, components/search/HotelSearchForm.tsx
lib/points/calcPoints.ts << components/HotelDetailModal.tsx, components/search/SearchBoard.tsx, hooks/usePointsCalc.ts, lib/points/index.ts
components/Footer.tsx << app/offers/page.tsx, app/search/page.tsx, components/AppShell.tsx
hooks/useTrips.ts << app/trip-planner/[id]/page.tsx, app/trip-planner/page.tsx, components/AddToTripButton.tsx
lib/trips.ts << app/trip-planner/[id]/page.tsx, app/trip-planner/page.tsx, hooks/useTrips.ts
components/PointsGrid.tsx << components/FlightCard.tsx, components/HotelDetailModal.tsx, components/search/SearchBoard.tsx
server/routers/_app.ts << app/api/trpc/[trpc]/route.ts, lib/trpc-client.ts
components/AppShell.tsx << app/flights/page.tsx, app/hotels/page.tsx
components/FlightCard.tsx << app/flights/page.tsx, app/trip-planner/[id]/page.tsx
components/search/FlightSearchForm.tsx << app/flights/page.tsx, app/search/page.tsx
components/HotelCard.tsx << app/hotels/page.tsx, app/trip-planner/[id]/page.tsx
components/GeoMap.tsx << app/hotels/page.tsx, app/trip-planner/[id]/page.tsx
components/search/HotelSearchForm.tsx << app/hotels/page.tsx, app/search/page.tsx
components/offers/OfferCategoryChips.tsx << app/offers/page.tsx, components/offers/OffersGrid.tsx
lib/cardImages.ts << app/onboarding/page.tsx, components/offers/admin/AdminAdEditor.tsx
lib/searchUrls.ts << app/search/page.tsx, components/search/FlightSearchForm.tsx
lib/bookmarks.ts << components/AddToTripButton.tsx, hooks/useBookmarks.ts
lib/points/rankOptions.ts << components/BestPortalPanel.tsx, components/PointsGrid.tsx
hooks/usePointsCalc.ts << components/FlightCard.tsx, components/search/SearchBoard.tsx
components/AddToTripButton.tsx << components/FlightCard.tsx, components/HotelDetailModal.tsx
components/BestPortalPanel.tsx << components/FlightCard.tsx, components/HotelDetailModal.tsx
lib/places.ts << components/LocationSearch.tsx, server/routers/places.ts
components/offers/OfferCard.tsx << components/offers/OfferCategoryChips.tsx, components/offers/OffersGrid.tsx
components/DateInput.tsx << components/search/FlightSearchForm.tsx, components/search/HotelSearchForm.tsx
lib/hotelbeds.ts << lib/adapters/hotelbeds-adapter.ts, server/routers/stays.ts
lib/adapters/hotelbeds-adapter.ts << lib/hotelbeds-match.ts, server/routers/stays.ts
lib/points/portalMarkup.ts << lib/points/calcPoints.ts, lib/points/index.ts
lib/duffel.ts << server/routers/flights.ts, server/routers/stays.ts
components/offers/admin/OffersAdminShell.tsx << app/admin/page.tsx
components/HotelDetailModal.tsx << app/hotels/page.tsx
app/providers.tsx << app/layout.tsx
components/offers/FeaturedOfferHero.tsx << app/offers/page.tsx
components/offers/OffersGrid.tsx << app/offers/page.tsx
components/offers/CommunityBoard.tsx << app/offers/page.tsx
components/search/SearchModeToggle.tsx << app/search/page.tsx
components/search/SearchBoard.tsx << app/search/page.tsx
hooks/useBookmarks.ts << app/trip-planner/[id]/page.tsx
components/BalancePanel.tsx << components/AppShell.tsx
components/CardSelector.tsx << components/AppShell.tsx
hooks/useDebounce.ts << components/LocationSearch.tsx
components/ThemeToggle.tsx << components/NavBar.tsx
components/ProfilePopup.tsx << components/NavBar.tsx
components/offers/OfferDetailModal.tsx << components/offers/OfferCard.tsx
lib/partnerImages.ts << components/offers/admin/AdminOfferEditor.tsx
components/offers/admin/AdminOffersTable.tsx << components/offers/admin/OffersAdminShell.tsx
components/offers/admin/AdminAdsTable.tsx << components/offers/admin/OffersAdminShell.tsx
components/offers/admin/AdminAdEditor.tsx << components/offers/admin/OffersAdminShell.tsx
components/offers/admin/AdminOfferEditor.tsx << components/offers/admin/OffersAdminShell.tsx
components/offers/admin/PendingReviewTable.tsx << components/offers/admin/OffersAdminShell.tsx
components/offers/admin/SyncRunsLog.tsx << components/offers/admin/OffersAdminShell.tsx
components/offers/admin/AdminTransferPartnerEditor.tsx << components/offers/admin/OffersAdminShell.tsx
components/offers/admin/AdminHotelCollectionEditor.tsx << components/offers/admin/OffersAdminShell.tsx
components/offers/admin/AdminTransferPartnersTable.tsx << components/offers/admin/OffersAdminShell.tsx
components/offers/admin/AdminHotelCollectionsTable.tsx << components/offers/admin/OffersAdminShell.tsx
server/routers/flights.ts << server/routers/_app.ts
server/routers/stays.ts << server/routers/_app.ts
server/routers/places.ts << server/routers/_app.ts
server/routers/offers.ts << server/routers/_app.ts
server/routers/portalData.ts << server/routers/_app.ts
lib/hotelbeds-match.ts << server/routers/stays.ts
```
