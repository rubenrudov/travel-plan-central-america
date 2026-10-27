# OpenStreetMap expedition planning

Itinerary and Destinations include a Leaflet/OpenStreetMap view. No Google account, map key, extra Supabase migration or paid service is required. Location fields are part of the existing private workspace JSON and sync through the existing revision-checked save path.

## Locate records

Open **Map locations**, search a destination or saved accommodation address, review the returned matches and choose one. Search never silently chooses the first result. Alternatively select **Place pin** and click the map. Destinations and bookings also have optional latitude/longitude fields in their editors. Negative longitude is supported; both coordinates are required. Map latitude is limited to -85…85 for the Web Mercator tile display.

Coordinates, source label and the exact query are saved with the record. If an address or destination changes, old query-bound coordinates are no longer displayed. Explicit editor address changes also clear unchanged old pins. A hotel is never located at a city center merely because its destination is known: it needs its own address match or manual pin. Existing records without coordinates are listed as unplaced, not assigned invented positions.

## Connections

Transport records can link origin and arrival to destinations. Exact unique destination names/aliases also resolve existing endpoint labels. An airport or tour meeting point is not assumed to share a city's coordinates. Unmatched endpoint labels appear in Map locations so they can be located separately.

- Flight: dotted planning curve with a plane icon at the curve midpoint.
- Ferry / Boat: dotted planning curve with a ship icon at the midpoint.
- Car / Rental car / road Transfer / Shuttle / Bus: an OSRM driving route, labeled as an estimate. It does not represent an operator's bus/shuttle service or live road conditions.
- Unchosen or other transport: a straight dotted planning connector, with no invented vehicle mode.

Ordered itinerary destinations get an unspecified planning connector only where no corresponding transport leg exists. Curves are schematic, not actual flight paths, shipping lanes or navigation instructions. Driving requests use the public OSRM demo service; if unavailable, a labeled dotted planning line is shown, not a fabricated road route. Results include approximate road distance/time in the line tooltip and are cached for seven days. Service availability and map coverage are not guaranteed. Public services should be replaced with a suitable hosted/self-hosted provider before scaling beyond this personal app.

## Accommodation cards

Hover or tap the accommodation marker to view the saved property name, provider (Booking.com, Hostelworld, direct or other), address, dates, booking status, original-currency cost when entered, cancellation cutoff/verification, policy and saved provider link. **Open record** opens the existing editor. The card shows saved data; no live provider prices, ratings, photos or availability are fetched. No booking reference, payments, cancellation text or notes are sent to the map services.

## Public service use

Tiles: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, with visible OpenStreetMap attribution and link. There is no bulk tile prefetch/offline download. Standard browser caching is preserved.

Address search: `https://nominatim.openstreetmap.org/search`. Only an explicit user search sends the selected place name or address; there is no autocomplete or automatic bulk geocoding. Searches are serialized at no faster than one every 1.1 seconds per browser instance, and cached locally for 180 days. The browser's Referer identifies the application. Results require user selection. Geocoding cache contains those searched addresses; clear browser storage to remove it. Saved coordinates are backed up with expedition records.

Roads: `https://router.project-osrm.org/route/v1/driving/…`. This receives endpoint coordinates only. Road requests are processed sequentially and cached, and failures are surfaced in the UI. These map features need Internet access; manual coordinates can still be entered if lookup is unavailable, but the basemap tiles still require connectivity.

See the providers' current usage policies before increasing traffic: https://operations.osmfoundation.org/policies/nominatim/ and https://operations.osmfoundation.org/policies/tiles/ .

## Validation limits

Unit tests cover endpoint matching, stale pin refusal, coordinate ranges, flight/ferry arc geometry and transport modes. Browser tests mock public services and verify icons, road geometry, geocoding confirmation/save/reload, accommodation hover/tap cards, mobile width, error labeling and manual pin placement without a geocoder. The cloud environment blocks direct live Nominatim/OSRM requests; successful third-party responses are not claimed as live validation. Their failures and manual alternatives are tested. Check the real providers from the deployed browser when using the feature.
