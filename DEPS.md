# Module Dependency Map (generated 2026-11-01)

Reverse import map: `target << files that import it`. Sorted by importer count.
Grep this file for a path to get its importers (blast radius) — do not read the whole file.
Covers `@/` and relative imports across app/, components/, lib/, server/, contexts/, hooks/.
Auto-regenerated each session by scripts/dep-graph.mjs (SessionStart hook) — do not edit.

```
components/ui/button.ts << app/auth/page.tsx, app/hotels/page.tsx, app/onboarding/page.tsx, app/trip-planner/[id]/page.tsx, app/you/page.tsx, components/board/compose/Composer.tsx, components/board/feed/BoardHeader.tsx, components/board/feed/BoardPage.tsx, components/board/feed/PostCard.tsx, components/board/feed/SavedPostsMenu.tsx, components/board/moderation/ModMenu.tsx, components/board/moderation/ModStrip.tsx, components/board/moderation/ReportDialog.tsx, components/board/moderation/TopicChipMenu.tsx, components/board/offers/OfferModal.tsx, components/board/post/CommentThread.tsx, components/board/post/PostDetail.tsx, components/board/post/PostDetailPage.tsx, components/board/post/ReplyBox.tsx, components/board/shared/SignInPrompt.tsx, components/booking/LeavingPanel.tsx, components/booking/RedemptionTable.tsx, components/discover/DiscoverBoardPromo.tsx, components/discover/DiscoverMasthead.tsx, components/discover/DiscoverOfferModal.tsx, components/flights/FlightCard.tsx, components/layout/NavBar.tsx, components/layout/ProfilePopup.tsx, components/layout/ThemeToggle.tsx, components/offers/AffiliateAdSpot.tsx, components/offers/SaveOfferButton.tsx, components/offers/SavedOffersMenu.tsx, components/offers/admin/AdminAdEditor.tsx, components/offers/admin/AdminHotelCollectionEditor.tsx, components/offers/admin/AdminOfferEditor.tsx, components/offers/admin/AdminPointsValuationEditor.tsx, components/offers/admin/AdminTransferPartnerEditor.tsx, components/offers/admin/OffersAdminShell.tsx, components/offers/admin/PendingReviewTable.tsx, components/search/MobileResultsHeader.tsx, components/ui/SavedPopover.tsx
lib/points/types.ts << app/onboarding/page.tsx, app/search/page.tsx, components/board/compose/NewOfferForm.tsx, components/booking/CompareModal.tsx, components/booking/RedemptionTable.tsx, components/discover/DiscoverOfferModal.tsx, components/hotels/HotelBestRedemptionBar.tsx, components/hotels/HotelDetailModal.tsx, components/layout/ProfilePopup.tsx, components/offers/CollectionBanner.tsx, components/offers/TransferBonusBanner.tsx, components/offers/admin/AdminAdEditor.tsx, components/offers/admin/AdminOfferEditor.tsx, components/search/SearchBoard.tsx, components/wallet/BalancePanel.tsx, components/wallet/CardSelector.tsx, contexts/AuthContext.tsx, contexts/SelectedCardsContext.tsx, hooks/usePointsCalc.ts, hooks/useRankedViews.ts, lib/board/memberOffer.ts, lib/cardImages.ts, lib/flights/itinerary.ts, lib/points/calcPoints.ts, lib/points/index.ts, lib/points/partnerLinks.ts, lib/points/partnerOptions.ts, lib/points/portalMarkup.ts, lib/points/rankOptions.ts, lib/points/rowView.ts, lib/points/transferBonus.ts, lib/points/transferPartners.ts, lib/points/transferRatio.ts, lib/types/portalData.ts, server/routers/portalData.ts
contexts/ThemeContext.tsx << app/auth/page.tsx, app/auth/update-password/page.tsx, app/discover/page.tsx, app/flights/page.tsx, app/hotels/page.tsx, app/layout.tsx, app/offers/page.tsx, app/onboarding/page.tsx, app/page.tsx, app/search/page.tsx, app/settings/page.tsx, app/trip-planner/[id]/page.tsx, app/trip-planner/page.tsx, app/you/page.tsx, components/booking/CompareModal.tsx, components/booking/RedemptionTable.tsx, components/flights/FlightCard.tsx, components/hotels/HotelCard.tsx, components/hotels/HotelDetailModal.tsx, components/inputs/DateInput.tsx, components/inputs/GuestsDropdown.tsx, components/inputs/LocationSearch.tsx, components/layout/AddToTripButton.tsx, components/layout/AppShell.tsx, components/layout/ProfilePopup.tsx, components/layout/ThemeToggle.tsx, components/offers/TransferBonusBanner.tsx, components/offers/admin/OffersAdminShell.tsx, components/search/FlightSearchForm.tsx, components/search/HotelSearchForm.tsx, components/search/SearchBoard.tsx, components/search/SearchModeToggle.tsx, components/wallet/BalancePanel.tsx, components/wallet/CardSelector.tsx
lib/trpc-client.ts << app/discover/page.tsx, app/flights/page.tsx, app/hotels/page.tsx, app/offers/page.tsx, app/search/page.tsx, app/trip-planner/[id]/page.tsx, app/trip-planner/page.tsx, components/board/compose/NewOfferForm.tsx, components/hotels/GeoMap.tsx, components/hotels/GoogleReviews.tsx, components/hotels/HotelDetailModal.tsx, components/inputs/LocationSearch.tsx, components/offers/AffiliateAdSpot.tsx, components/offers/admin/AdminAdEditor.tsx, components/offers/admin/AdminAdsTable.tsx, components/offers/admin/AdminHotelCollectionEditor.tsx, components/offers/admin/AdminOfferEditor.tsx, components/offers/admin/AdminOffersTable.tsx, components/offers/admin/AdminPointsValuationEditor.tsx, components/offers/admin/AdminPointsValuationsTable.tsx, components/offers/admin/AdminTransferPartnerEditor.tsx, components/offers/admin/AdminTransferPartnersTable.tsx, components/offers/admin/AdminTravelCollectionsTable.tsx, components/offers/admin/OffersAdminShell.tsx, components/offers/admin/PendingReviewTable.tsx, components/offers/admin/adminTableShared.tsx, hooks/useBoard.ts, hooks/useBookingReports.ts, hooks/usePointsCalc.ts, hooks/useRankedViews.ts, hooks/useSavedOffers.ts, lib/points/transferBonus.ts
lib/board/types.ts << components/board/compose/Composer.tsx, components/board/compose/OfferLinkPicker.tsx, components/board/compose/TopicPicker.tsx, components/board/feed/BoardFilters.tsx, components/board/feed/PostCard.tsx, components/board/feed/SavedPostsMenu.tsx, components/board/feed/TopicFilter.tsx, components/board/moderation/ModBanner.tsx, components/board/moderation/ModMenu.tsx, components/board/moderation/ModStrip.tsx, components/board/moderation/TopicChipMenu.tsx, components/board/offers/OfferModal.tsx, components/board/offers/OfferPreview.tsx, components/board/post/Badges.tsx, components/board/post/CommentThread.tsx, components/board/post/VoteControl.tsx, hooks/useBoard.ts, lib/board/cache.ts, lib/board/server/feed.ts, lib/board/server/hydrate.ts, lib/board/server/review.ts, lib/board/server/topics.ts, lib/board/visibility.ts, server/routers/board.ts, server/routers/boardAdmin.ts
lib/types/offers.ts << app/discover/page.tsx, app/offers/page.tsx, components/booking/RedemptionTable.tsx, components/discover/DiscoverLead.tsx, components/discover/DiscoverMasthead.tsx, components/discover/DiscoverOfferModal.tsx, components/discover/DiscoverRail.tsx, components/discover/DiscoverSecondary.tsx, components/discover/OfferRow.tsx, components/offers/AffiliateAdSpot.tsx, components/offers/SaveOfferButton.tsx, components/offers/SavedOffersMenu.tsx, components/offers/admin/AdminAdEditor.tsx, components/offers/admin/AdminAdsTable.tsx, components/offers/admin/AdminOfferEditor.tsx, components/offers/admin/AdminOffersTable.tsx, components/offers/admin/OffersAdminShell.tsx, hooks/useSavedOffers.ts, lib/board/memberOffer.ts, lib/discover/offerCopy.ts, lib/points/rowView.ts, lib/points/spendingBonusMatch.ts, lib/points/transferBonus.ts, server/routers/offers.ts
components/board/shared/icons.tsx << components/board/compose/Composer.tsx, components/board/compose/OfferLinkPicker.tsx, components/board/compose/TopicPicker.tsx, components/board/feed/BoardFilters.tsx, components/board/feed/BoardHeader.tsx, components/board/feed/PostCard.tsx, components/board/feed/SavedPostsMenu.tsx, components/board/moderation/ModBanner.tsx, components/board/moderation/ModMenu.tsx, components/board/moderation/ModStrip.tsx, components/board/moderation/TopicChipMenu.tsx, components/board/offers/OfferModal.tsx, components/board/offers/OfferPreview.tsx, components/board/post/Badges.tsx, components/board/post/CommentThread.tsx, components/board/post/PostDetail.tsx, components/board/post/PostDetailPage.tsx, components/board/post/VoteControl.tsx, components/board/shared/Dialog.tsx
contexts/AuthContext.tsx << app/layout.tsx, app/onboarding/page.tsx, app/page.tsx, app/search/page.tsx, app/settings/page.tsx, app/trip-planner/page.tsx, app/you/page.tsx, components/booking/CompareModal.tsx, components/layout/AppShell.tsx, components/layout/NavBar.tsx, components/layout/ProfilePopup.tsx, components/offers/SaveOfferButton.tsx, components/offers/SavedOffersMenu.tsx, contexts/SelectedCardsContext.tsx, hooks/useBoard.ts, hooks/useIsAdmin.ts, hooks/useSavedOffers.ts, hooks/useTrips.ts
lib/board/constants.ts << components/board/compose/Composer.tsx, components/board/compose/TopicPicker.tsx, components/board/moderation/ModMenu.tsx, components/board/moderation/ReportDialog.tsx, components/board/post/ReplyBox.tsx, components/offers/admin/PendingReviewTable.tsx, lib/board/moderation/classify.ts, lib/board/moderation/decide.ts, lib/board/moderation/links.ts, lib/board/server/feed.ts, lib/board/server/hydrate.ts, lib/board/server/rescan.ts, lib/board/server/review.ts, lib/board/server/topics.ts, lib/board/topics.ts, lib/board/types.ts, server/routers/board.ts, server/routers/boardAdmin.ts
lib/types/portalData.ts << components/offers/admin/AdminHotelCollectionEditor.tsx, components/offers/admin/AdminPointsValuationEditor.tsx, components/offers/admin/AdminPointsValuationsTable.tsx, components/offers/admin/AdminTransferPartnerEditor.tsx, components/offers/admin/AdminTransferPartnersTable.tsx, components/offers/admin/AdminTravelCollectionsTable.tsx, components/offers/admin/OffersAdminShell.tsx, components/offers/admin/PendingReviewDetailModal.tsx, components/offers/admin/PendingReviewTable.tsx, components/offers/admin/SyncRunsLog.tsx, components/offers/admin/adminTableShared.tsx, lib/travelCollectionMatch.ts, lib/types/offers.ts, server/routers/flights.ts, server/routers/portalData.ts, server/routers/stays.ts
hooks/useBoard.ts << components/board/compose/Composer.tsx, components/board/compose/OfferLinkPicker.tsx, components/board/feed/BoardPage.tsx, components/board/feed/PostCard.tsx, components/board/feed/SavedPostsMenu.tsx, components/board/moderation/ModMenu.tsx, components/board/moderation/ModStrip.tsx, components/board/moderation/ReportDialog.tsx, components/board/moderation/TopicChipMenu.tsx, components/board/post/CommentThread.tsx, components/board/post/PostDetail.tsx, components/board/post/PostDetailPage.tsx, components/offers/SaveOfferButton.tsx, components/offers/SavedOffersMenu.tsx
lib/board/errors.ts << components/board/compose/Composer.tsx, components/board/compose/OfferLinkPicker.tsx, components/board/feed/BoardPage.tsx, components/board/feed/SavedPostsMenu.tsx, components/board/moderation/ModMenu.tsx, components/board/moderation/ModStrip.tsx, components/board/moderation/ReportDialog.tsx, components/board/moderation/TopicChipMenu.tsx, components/board/post/CommentThread.tsx, components/board/post/PostDetail.tsx, components/board/post/PostDetailPage.tsx, components/offers/SavedOffersMenu.tsx, hooks/useBoard.ts
components/board/shared/Toast.tsx << app/discover/board/layout.tsx, app/discover/page.tsx, app/offers/page.tsx, components/board/compose/Composer.tsx, components/board/feed/PostCard.tsx, components/board/moderation/ModMenu.tsx, components/board/moderation/ModStrip.tsx, components/board/moderation/ReportDialog.tsx, components/board/moderation/TopicChipMenu.tsx, components/board/post/CommentThread.tsx, components/board/post/PostDetail.tsx, hooks/useBoard.ts
lib/discover/offerCopy.ts << app/discover/page.tsx, app/offers/page.tsx, components/board/compose/NewOfferForm.tsx, components/discover/DiscoverLead.tsx, components/discover/DiscoverMasthead.tsx, components/discover/DiscoverOfferModal.tsx, components/discover/DiscoverSecondary.tsx, components/discover/OfferRow.tsx, components/offers/SavedOffersMenu.tsx, hooks/useSavedOffers.ts, lib/board/offerView.ts, server/routers/board.ts
lib/feature-flags.ts << components/layout/MobileTabBar.tsx, components/layout/NavBar.tsx, lib/board/moderation/classify.ts, lib/board/server/cache.ts, lib/places.ts, server/routers/boardAdmin.ts, server/routers/flights.ts, server/routers/offers.ts, server/routers/places.ts, server/routers/portalData.ts, server/routers/stays.ts, server/trpc.ts
lib/board/server/errors.ts << lib/board/server/actor.ts, lib/board/server/backfill.ts, lib/board/server/dormancy.ts, lib/board/server/feed.ts, lib/board/server/hydrate.ts, lib/board/server/purgeExpired.ts, lib/board/server/rescan.ts, lib/board/server/review.ts, lib/board/server/systemPost.ts, lib/board/server/topics.ts, server/routers/board.ts, server/routers/boardAdmin.ts
contexts/SelectedCardsContext.tsx << app/flights/page.tsx, app/layout.tsx, app/search/page.tsx, app/you/page.tsx, components/discover/DiscoverOfferModal.tsx, components/hotels/HotelDetailModal.tsx, components/layout/AppShell.tsx, components/layout/ProfilePopup.tsx, components/wallet/BalancePanel.tsx, components/wallet/CardSelector.tsx, hooks/usePointsCalc.ts
components/layout/NavBar.tsx << app/discover/board/layout.tsx, app/discover/page.tsx, app/offers/page.tsx, app/search/page.tsx, app/settings/page.tsx, app/trip-planner/[id]/page.tsx, app/trip-planner/page.tsx, app/you/page.tsx, components/layout/AppShell.tsx, components/offers/admin/OffersAdminShell.tsx
lib/reports/types.ts << components/booking/CompareModal.tsx, components/booking/LeavingPanel.tsx, components/booking/QuoteFields.tsx, components/booking/ReportsList.tsx, components/booking/bookingStyles.ts, hooks/useBookingReports.ts, lib/reports/classify.ts, lib/reports/subject.ts, server/routers/reports.ts
server/trpc.ts << server/routers/_app.ts, server/routers/board.ts, server/routers/boardAdmin.ts, server/routers/flights.ts, server/routers/offers.ts, server/routers/places.ts, server/routers/portalData.ts, server/routers/reports.ts, server/routers/stays.ts
lib/supabase/server.ts << app/admin/page.tsx, app/auth/callback/route.ts, server/routers/flights.ts, server/routers/offers.ts, server/routers/portalData.ts, server/routers/reports.ts, server/routers/stays.ts, server/trpc.ts
lib/offers/live.ts << app/discover/page.tsx, app/offers/page.tsx, lib/board/memberOffer.ts, lib/board/server/backfill.ts, lib/board/server/feed.ts, lib/board/server/systemPost.ts, server/routers/board.ts, server/routers/offers.ts
components/board/shared/Dialog.tsx << components/board/compose/Composer.tsx, components/board/moderation/ModMenu.tsx, components/board/moderation/ReportDialog.tsx, components/board/moderation/TopicChipMenu.tsx, components/board/offers/OfferModal.tsx, components/board/post/PostDetail.tsx, components/board/shared/SignInPrompt.tsx, components/offers/admin/PendingReviewTable.tsx
hooks/useScrollLock.ts << components/board/shared/Dialog.tsx, components/booking/CompareModal.tsx, components/discover/DiscoverOfferModal.tsx, components/discover/FilterDropdown.tsx, components/hotels/HotelDetailModal.tsx, components/layout/AppShell.tsx, components/offers/admin/PendingReviewDetailModal.tsx, components/search/SearchBoard.tsx
lib/cache-config.ts << lib/board/server/cache.ts, lib/places.ts, server/routers/board.ts, server/routers/boardAdmin.ts, server/routers/flights.ts, server/routers/offers.ts, server/routers/portalData.ts, server/routers/stays.ts
components/inputs/LocationSearch.tsx << app/flights/page.tsx, app/hotels/page.tsx, app/search/page.tsx, app/trip-planner/[id]/page.tsx, app/trip-planner/page.tsx, components/search/FlightSearchForm.tsx, components/search/HotelSearchForm.tsx
components/offers/admin/adminTableShared.tsx << components/offers/admin/AdminAdsTable.tsx, components/offers/admin/AdminOffersTable.tsx, components/offers/admin/AdminPointsValuationsTable.tsx, components/offers/admin/AdminTransferPartnersTable.tsx, components/offers/admin/AdminTravelCollectionsTable.tsx, components/offers/admin/OffersAdminShell.tsx, components/offers/admin/PendingReviewTable.tsx
lib/points/transferPartners.ts << lib/board/moderation/lexicon.ts, lib/board/topics.ts, lib/flights/itinerary.ts, lib/points/calcPoints.ts, lib/points/index.ts, lib/points/partnerOptions.ts, server/routers/portalData.ts
lib/redis.ts << lib/board/server/cache.ts, lib/places.ts, server/routers/boardAdmin.ts, server/routers/flights.ts, server/routers/offers.ts, server/routers/portalData.ts, server/routers/stays.ts
lib/points/transferBonus.ts << app/flights/page.tsx, components/booking/RedemptionTable.tsx, components/hotels/HotelCard.tsx, components/offers/TransferBonusBanner.tsx, hooks/useRankedViews.ts, lib/points/rowView.ts
components/ui/field.ts << components/board/compose/Composer.tsx, components/board/compose/NewOfferForm.tsx, components/board/compose/TopicPicker.tsx, components/board/moderation/ModMenu.tsx, components/board/moderation/ReportDialog.tsx, components/board/moderation/TopicChipMenu.tsx
lib/board/limits.ts << lib/board/moderation/decide.ts, lib/board/server/actor.ts, lib/board/server/errors.ts, lib/board/server/moderate.ts, lib/board/topicSelection.ts, server/routers/board.ts
lib/points/programNames.ts << lib/board/moderation/lexicon.ts, lib/board/topics.ts, lib/points/partnerLinks.ts, lib/points/transferPartners.ts, lib/reports/subject.ts, server/routers/portalData.ts
lib/board/server/cache.ts << lib/board/server/dormancy.ts, lib/board/server/purgeExpired.ts, lib/board/server/review.ts, lib/board/server/systemPost.ts, server/routers/board.ts, server/routers/boardAdmin.ts
lib/time.ts << app/api/trpc/[trpc]/route.ts, app/discover/page.tsx, app/offers/page.tsx, lib/offers/live.ts, lib/trpc-client.ts
components/layout/Footer.tsx << app/discover/board/layout.tsx, app/discover/page.tsx, app/offers/page.tsx, app/search/page.tsx, app/you/page.tsx
components/offers/AffiliateAdSpot.tsx << app/discover/page.tsx, app/flights/page.tsx, app/hotels/page.tsx, app/trip-planner/[id]/page.tsx, components/layout/AppShell.tsx
lib/pagination.ts << app/flights/page.tsx, app/hotels/page.tsx, components/layout/FeaturedPagination.tsx, components/layout/Pagination.tsx, hooks/usePerPage.ts
lib/points/calcPoints.ts << app/flights/page.tsx, components/hotels/HotelDetailModal.tsx, components/search/SearchBoard.tsx, hooks/usePointsCalc.ts, lib/points/index.ts
hooks/useToday.ts << app/trip-planner/[id]/page.tsx, app/trip-planner/page.tsx, components/booking/LeavingPanel.tsx, components/booking/QuoteFields.tsx, components/inputs/DateInput.tsx
lib/dates.ts << app/trip-planner/[id]/page.tsx, components/booking/CompareModal.tsx, components/booking/QuoteFields.tsx, components/inputs/DateInput.tsx, hooks/useToday.ts
hooks/useIsAdmin.ts << app/you/page.tsx, components/board/moderation/ModMenu.tsx, components/board/moderation/ModStrip.tsx, components/board/moderation/TopicChipMenu.tsx, hooks/useBoard.ts
lib/board/format.ts << components/board/feed/PostCard.tsx, components/board/feed/SavedPostsMenu.tsx, components/board/post/Badges.tsx, components/board/post/CommentThread.tsx, components/board/post/PostDetail.tsx
lib/board/moderation/blocklist.ts << lib/board/moderation/decide.ts, lib/board/server/moderate.ts, lib/board/server/rescan.ts, server/routers/board.ts, server/routers/boardAdmin.ts
lib/board/server/feed.ts << lib/board/server/hydrate.ts, lib/board/server/review.ts, server/routers/board.ts, server/routers/boardAdmin.ts, server/routers/portalData.ts
lib/board/server/audit.ts << lib/board/server/moderate.ts, lib/board/server/rescan.ts, lib/board/server/review.ts, server/routers/board.ts, server/routers/boardAdmin.ts
lib/supabase/admin.ts << server/routers/board.ts, server/routers/boardAdmin.ts, server/routers/offers.ts, server/routers/portalData.ts, server/routers/reports.ts
lib/supabase/client.ts << app/auth/page.tsx, app/auth/update-password/page.tsx, app/page.tsx, app/settings/page.tsx
components/inputs/GuestsDropdown.tsx << app/hotels/page.tsx, app/search/page.tsx, app/trip-planner/[id]/page.tsx, components/search/HotelSearchForm.tsx
lib/board/memberOffer.ts << components/board/compose/Composer.tsx, components/board/compose/NewOfferForm.tsx, components/offers/admin/AdminOfferEditor.tsx, server/routers/board.ts
components/board/shared/share.ts << components/board/compose/Composer.tsx, components/board/feed/PostCard.tsx, components/board/feed/SavedPostsMenu.tsx, components/board/post/PostDetail.tsx
lib/board/topics.ts << components/board/compose/TopicPicker.tsx, lib/board/server/systemPost.ts, lib/board/server/topics.ts, server/routers/boardAdmin.ts
lib/board/cache.ts << components/board/feed/BoardFilters.tsx, components/board/post/PostDetail.tsx, components/board/post/VoteControl.tsx, hooks/useBoard.ts
components/board/post/Badges.tsx << components/board/feed/BoardSidebar.tsx, components/board/feed/PostCard.tsx, components/board/feed/SavedPostsMenu.tsx, components/board/post/PostDetail.tsx
lib/points/rowView.ts << components/booking/CompareModal.tsx, components/booking/RedemptionTable.tsx, components/flights/FlightCard.tsx, hooks/useRankedViews.ts
components/booking/bookingStyles.ts << components/booking/CompareModal.tsx, components/booking/LeavingPanel.tsx, components/booking/QuoteFields.tsx, components/booking/ReportsList.tsx
lib/board/offerView.ts << lib/board/memberOffer.ts, lib/board/server/hydrate.ts, lib/board/types.ts, server/routers/board.ts
components/board/shared/FeedSkeleton.tsx << app/discover/board/page.tsx, components/board/feed/BoardPage.tsx, components/board/post/PostDetailPage.tsx
lib/flights/itinerary.ts << app/flights/page.tsx, components/flights/AirlineGroupCard.tsx, components/flights/FlightCard.tsx
components/discover/FilterDropdown.tsx << app/offers/page.tsx, components/board/feed/BoardFilters.tsx, components/board/feed/TopicFilter.tsx
hooks/useTrips.ts << app/trip-planner/[id]/page.tsx, app/trip-planner/page.tsx, components/layout/AddToTripButton.tsx
lib/trips.ts << app/trip-planner/[id]/page.tsx, app/trip-planner/page.tsx, hooks/useTrips.ts
components/board/shared/backLink.ts << components/board/compose/Composer.tsx, components/board/feed/BoardPage.tsx, components/board/post/PostDetailPage.tsx
hooks/useDebounce.ts << components/board/compose/OfferLinkPicker.tsx, components/board/feed/BoardFilters.tsx, components/inputs/LocationSearch.tsx
lib/board/filters.ts << components/board/feed/BoardFilters.tsx, components/board/feed/BoardPage.tsx, hooks/useBoard.ts
components/board/moderation/ModBanner.tsx << components/board/feed/PostCard.tsx, components/board/post/CommentThread.tsx, components/board/post/PostDetail.tsx
components/board/moderation/ModMenu.tsx << components/board/feed/PostCard.tsx, components/board/post/CommentThread.tsx, components/board/post/PostDetail.tsx
components/board/moderation/ModStrip.tsx << components/board/feed/PostCard.tsx, components/board/post/CommentThread.tsx, components/board/post/PostDetail.tsx
components/board/moderation/ReportDialog.tsx << components/board/feed/PostCard.tsx, components/board/post/CommentThread.tsx, components/board/post/PostDetail.tsx
components/board/post/VoteControl.tsx << components/board/feed/PostCard.tsx, components/board/post/CommentThread.tsx, components/board/post/PostDetail.tsx
lib/board/avatar.ts << components/board/shared/Avatar.tsx, lib/board/server/hydrate.ts, lib/board/types.ts
lib/reports/subject.ts << components/booking/CompareModal.tsx, components/flights/FlightCard.tsx, components/hotels/HotelDetailModal.tsx
lib/reports/classify.ts << components/booking/CompareModal.tsx, components/booking/ReportsList.tsx, server/routers/reports.ts
components/discover/PhotoPlaceholder.tsx << components/discover/DiscoverLead.tsx, components/discover/DiscoverOfferModal.tsx, components/discover/DiscoverSecondary.tsx
components/offers/SaveOfferButton.tsx << components/discover/DiscoverOfferModal.tsx, components/discover/OfferRow.tsx, components/offers/SavedOffersMenu.tsx
hooks/usePointsCalc.ts << components/flights/FlightCard.tsx, components/hotels/HotelCard.tsx, components/search/SearchBoard.tsx
lib/points/rankOptions.ts << components/hotels/HotelBestRedemptionBar.tsx, hooks/useRankedViews.ts, lib/points/rowView.ts
lib/places.ts << components/inputs/LocationSearch.tsx, lib/airports.ts, server/routers/places.ts
lib/textMatch.ts << lib/adapters/room-name-match.ts, lib/hotelbeds-match.ts, lib/travelCollectionMatch.ts
lib/board/server/systemPost.ts << lib/board/server/backfill.ts, server/routers/boardAdmin.ts, server/routers/offers.ts
lib/board/moderation/decide.ts << lib/board/server/hydrate.ts, lib/board/server/moderate.ts, server/routers/board.ts
lib/board/server/topics.ts << lib/board/server/systemPost.ts, server/routers/board.ts, server/routers/boardAdmin.ts
server/routers/_app.ts << app/api/trpc/[trpc]/route.ts, lib/trpc-client.ts
components/discover/DiscoverOfferModal.tsx << app/discover/page.tsx, app/offers/page.tsx
components/layout/AppShell.tsx << app/flights/page.tsx, app/hotels/page.tsx
components/flights/FlightCard.tsx << app/flights/page.tsx, app/trip-planner/[id]/page.tsx
components/search/FlightSearchForm.tsx << app/flights/page.tsx, app/search/page.tsx
components/layout/Pagination.tsx << app/flights/page.tsx, app/hotels/page.tsx
hooks/usePerPage.ts << app/flights/page.tsx, app/hotels/page.tsx
lib/searchSummary.ts << app/flights/page.tsx, app/hotels/page.tsx
components/hotels/HotelCard.tsx << app/hotels/page.tsx, app/trip-planner/[id]/page.tsx
components/hotels/GeoMap.tsx << app/hotels/page.tsx, app/trip-planner/[id]/page.tsx
components/search/HotelSearchForm.tsx << app/hotels/page.tsx, app/search/page.tsx
components/discover/OfferRow.tsx << app/offers/page.tsx, components/discover/DiscoverRail.tsx
components/offers/SavedOffersMenu.tsx << app/offers/page.tsx, components/discover/DiscoverMasthead.tsx
lib/cardImages.ts << app/onboarding/page.tsx, components/offers/admin/AdminAdEditor.tsx
lib/searchUrls.ts << app/search/page.tsx, components/search/FlightSearchForm.tsx
lib/board/topicSelection.ts << components/board/compose/Composer.tsx, components/board/compose/TopicPicker.tsx
lib/partnerImages.ts << components/board/compose/NewOfferForm.tsx, components/offers/admin/AdminOfferEditor.tsx
lib/points/partnerOptions.ts << components/board/compose/NewOfferForm.tsx, components/offers/admin/AdminOfferEditor.tsx
components/board/offers/OfferPreview.tsx << components/board/feed/PostCard.tsx, components/board/post/PostDetail.tsx
components/ui/SavedPopover.tsx << components/board/feed/SavedPostsMenu.tsx, components/offers/SavedOffersMenu.tsx
components/board/shared/Avatar.tsx << components/board/post/CommentThread.tsx, components/board/post/PostDetail.tsx
components/board/post/ReplyBox.tsx << components/board/post/CommentThread.tsx, components/board/post/PostDetail.tsx
components/booking/RedemptionTable.tsx << components/booking/CompareModal.tsx, components/search/SearchBoard.tsx
components/booking/QuoteFields.tsx << components/booking/CompareModal.tsx, components/booking/LeavingPanel.tsx
hooks/useRankedViews.ts << components/booking/RedemptionTable.tsx, components/flights/FlightCard.tsx
lib/points/partnerLinks.ts << components/booking/RedemptionTable.tsx, components/offers/CollectionBanner.tsx
components/offers/CollectionBanner.tsx << components/flights/FlightCard.tsx, components/hotels/HotelCard.tsx
components/offers/TransferBonusBanner.tsx << components/flights/FlightCard.tsx, components/hotels/HotelCard.tsx
components/layout/AddToTripButton.tsx << components/flights/FlightCard.tsx, components/hotels/HotelDetailModal.tsx
components/booking/CompareModal.tsx << components/flights/FlightCard.tsx, components/hotels/HotelDetailModal.tsx
lib/bookmarks.ts << components/layout/AddToTripButton.tsx, hooks/useBookmarks.ts
hooks/useSavedOffers.ts << components/offers/SaveOfferButton.tsx, components/offers/SavedOffersMenu.tsx
components/offers/admin/PendingReviewTable.tsx << components/offers/admin/OffersAdminShell.tsx, components/offers/admin/PendingReviewDetailModal.tsx
components/inputs/DateInput.tsx << components/search/FlightSearchForm.tsx, components/search/HotelSearchForm.tsx
lib/hotelbeds.ts << lib/adapters/hotelbeds-adapter.ts, server/routers/stays.ts
lib/adapters/duffel-rooms-adapter.ts << lib/adapters/room-name-match.ts, server/routers/stays.ts
lib/refreshAfterWrite.ts << hooks/useSavedOffers.ts, lib/board/cache.ts
lib/board/moderation/links.ts << lib/board/moderation/decide.ts, lib/board/server/moderate.ts
lib/board/moderation/lexicon.ts << lib/board/moderation/decide.ts, lib/board/server/moderate.ts
lib/board/moderation/classify.ts << lib/board/moderation/decide.ts, lib/board/server/moderate.ts
lib/board/moderation/normalize.ts << lib/board/moderation/lexicon.ts, lib/board/topics.ts
lib/board/visibility.ts << lib/board/server/hydrate.ts, server/routers/board.ts
lib/adapters/hotelbeds-adapter.ts << lib/hotelbeds-match.ts, server/routers/stays.ts
lib/points/portalMarkup.ts << lib/points/calcPoints.ts, lib/points/index.ts
server/routers/offers.ts << server/routers/_app.ts, server/routers/boardAdmin.ts
lib/board/server/hydrate.ts << server/routers/board.ts, server/routers/boardAdmin.ts
lib/board/server/moderate.ts << server/routers/board.ts, server/routers/boardAdmin.ts
lib/board/server/review.ts << server/routers/boardAdmin.ts, server/routers/portalData.ts
lib/duffel.ts << server/routers/flights.ts, server/routers/stays.ts
lib/travelCollectionMatch.ts << server/routers/flights.ts, server/routers/stays.ts
components/offers/admin/OffersAdminShell.tsx << app/admin/page.tsx
components/board/post/PostDetailPage.tsx << app/discover/board/[id]/page.tsx
components/board/feed/BoardPage.tsx << app/discover/board/page.tsx
components/discover/DiscoverMasthead.tsx << app/discover/page.tsx
components/discover/DiscoverLead.tsx << app/discover/page.tsx
components/discover/DiscoverSecondary.tsx << app/discover/page.tsx
components/discover/DiscoverRail.tsx << app/discover/page.tsx
components/discover/DiscoverCreatorBanner.tsx << app/discover/page.tsx
components/discover/DiscoverBoardPromo.tsx << app/discover/page.tsx
components/flights/AirlineGroupCard.tsx << app/flights/page.tsx
lib/points/spendingBonusMatch.ts << app/flights/page.tsx
components/hotels/HotelDetailModal.tsx << app/hotels/page.tsx
components/layout/FeaturedPagination.tsx << app/hotels/page.tsx
app/providers.tsx << app/layout.tsx
components/layout/MobileTabBar.tsx << app/layout.tsx
components/search/SearchModeToggle.tsx << app/search/page.tsx
components/search/SearchBoard.tsx << app/search/page.tsx
hooks/useBookmarks.ts << app/trip-planner/[id]/page.tsx
components/board/compose/KindPicker.tsx << components/board/compose/Composer.tsx
components/board/compose/NewOfferForm.tsx << components/board/compose/Composer.tsx
components/board/compose/OfferLinkPicker.tsx << components/board/compose/Composer.tsx
components/board/compose/TopicPicker.tsx << components/board/compose/Composer.tsx
components/board/feed/TopicFilter.tsx << components/board/feed/BoardFilters.tsx
components/board/feed/SavedPostsMenu.tsx << components/board/feed/BoardHeader.tsx
components/board/feed/BoardFilters.tsx << components/board/feed/BoardPage.tsx
components/board/feed/BoardHeader.tsx << components/board/feed/BoardPage.tsx
components/board/feed/BoardSidebar.tsx << components/board/feed/BoardPage.tsx
components/board/compose/Composer.tsx << components/board/feed/BoardPage.tsx
components/board/feed/PostCard.tsx << components/board/feed/BoardPage.tsx
components/board/shared/SignInPrompt.tsx << components/board/feed/BoardPage.tsx
components/board/moderation/TopicChipMenu.tsx << components/board/feed/TopicFilter.tsx
components/board/offers/OfferModal.tsx << components/board/offers/OfferPreview.tsx
components/board/post/CommentThread.tsx << components/board/post/PostDetail.tsx
components/board/post/PostDetail.tsx << components/board/post/PostDetailPage.tsx
components/booking/ReportsList.tsx << components/booking/CompareModal.tsx
components/booking/LeavingPanel.tsx << components/booking/CompareModal.tsx
hooks/useBookingReports.ts << components/booking/CompareModal.tsx
hooks/useMediaQuery.ts << components/discover/FilterDropdown.tsx
components/hotels/HotelBestRedemptionBar.tsx << components/hotels/HotelDetailModal.tsx
components/hotels/GoogleReviews.tsx << components/hotels/HotelDetailModal.tsx
components/wallet/BalancePanel.tsx << components/layout/AppShell.tsx
components/search/MobileResultsHeader.tsx << components/layout/AppShell.tsx
components/layout/ThemeToggle.tsx << components/layout/NavBar.tsx
components/layout/ProfilePopup.tsx << components/layout/NavBar.tsx
components/offers/admin/TopicMultiSelect.tsx << components/offers/admin/AdminOfferEditor.tsx
components/offers/admin/AdminOffersTable.tsx << components/offers/admin/OffersAdminShell.tsx
components/offers/admin/AdminAdsTable.tsx << components/offers/admin/OffersAdminShell.tsx
components/offers/admin/AdminAdEditor.tsx << components/offers/admin/OffersAdminShell.tsx
components/offers/admin/AdminOfferEditor.tsx << components/offers/admin/OffersAdminShell.tsx
components/offers/admin/SyncRunsLog.tsx << components/offers/admin/OffersAdminShell.tsx
components/offers/admin/AdminTransferPartnerEditor.tsx << components/offers/admin/OffersAdminShell.tsx
components/offers/admin/AdminHotelCollectionEditor.tsx << components/offers/admin/OffersAdminShell.tsx
components/offers/admin/AdminTransferPartnersTable.tsx << components/offers/admin/OffersAdminShell.tsx
components/offers/admin/AdminTravelCollectionsTable.tsx << components/offers/admin/OffersAdminShell.tsx
components/offers/admin/AdminPointsValuationEditor.tsx << components/offers/admin/OffersAdminShell.tsx
components/offers/admin/AdminPointsValuationsTable.tsx << components/offers/admin/OffersAdminShell.tsx
components/offers/admin/PendingReviewDetailModal.tsx << components/offers/admin/PendingReviewTable.tsx
lib/board/hot.ts << lib/board/server/feed.ts
lib/airports.ts << lib/places.ts
lib/points/transferRatio.ts << lib/points/transferPartners.ts
server/routers/flights.ts << server/routers/_app.ts
server/routers/stays.ts << server/routers/_app.ts
server/routers/places.ts << server/routers/_app.ts
server/routers/portalData.ts << server/routers/_app.ts
server/routers/reports.ts << server/routers/_app.ts
server/routers/board.ts << server/routers/_app.ts
server/routers/boardAdmin.ts << server/routers/board.ts
lib/board/server/actor.ts << server/routers/board.ts
lib/board/server/rescan.ts << server/routers/boardAdmin.ts
lib/adapters/room-name-match.ts << server/routers/stays.ts
lib/hotelbeds-match.ts << server/routers/stays.ts
```
