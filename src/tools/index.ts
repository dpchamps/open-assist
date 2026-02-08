import { decomposeMeal } from './decompose-meal.js';
import { getTime } from './get-time.js';
import { homeInventory } from './home-inventory.js';
import { krogerAuth } from './kroger/kroger-auth.js';
import { syncCartToKroger } from './kroger/sync-cart.js';
import { listCurrentUserDetails } from './list-current-user-details.js';
import { shoppingCart } from './shopping-cart.js';
import { searchNearby } from './tomtom/search-nearby.js';
import { timeToDestination } from './tomtom/time-to-destination.js';
import { weather } from './weather.js';

export const tools = [decomposeMeal, getTime, homeInventory, krogerAuth, listCurrentUserDetails, shoppingCart, searchNearby, syncCartToKroger, timeToDestination, weather];
