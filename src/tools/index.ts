import { decomposeMeal } from './decompose-meal.js';
import { getTime } from './get-time.js';
import { listCurrentUserDetails } from './list-current-user-details.js';
import { searchNearby } from './tomtom/search-nearby.js';
import { timeToDestination } from './tomtom/time-to-destination.js';
import { weather } from './weather.js';

export const tools = [decomposeMeal, getTime, listCurrentUserDetails, searchNearby, timeToDestination, weather];
