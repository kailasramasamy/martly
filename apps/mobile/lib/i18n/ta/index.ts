import type { Catalog } from "../index";
import { common } from "./common";
import { nav } from "./nav";
import { cart } from "./cart";
import { language } from "./language";
import { home } from "./home";
import { catalog } from "./catalog";
import { search } from "./search";
import { checkout } from "./checkout";
import { orders } from "./orders";
import { account } from "./account";
import { subscriptions } from "./subscriptions";
import { auth } from "./auth";

export const ta: Catalog = { common, nav, cart, language, home, catalog, search, checkout, orders, account, subscriptions, auth };
