/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as boss from "../boss.js";
import type * as duelCatalog from "../duelCatalog.js";
import type * as gameCatalog from "../gameCatalog.js";
import type * as missions from "../missions.js";
import type * as solo from "../solo.js";
import type * as tournament from "../tournament.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  boss: typeof boss;
  duelCatalog: typeof duelCatalog;
  gameCatalog: typeof gameCatalog;
  missions: typeof missions;
  solo: typeof solo;
  tournament: typeof tournament;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
