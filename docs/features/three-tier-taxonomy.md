# 3-Tier Taxonomy — Test Plan

## Overview

Replaced single recursive `Category` model with `Department` → `Category` → `Subcategory`. Imported 1,367 real FMCG products (2,358 variants, ~7K images) from grocery catalog.

**Data**: 16 departments, 87 categories, 447 subcategories, 485 brands, 1,367 products, 2,358 variants

---

## API Tests

### Categories

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 1 | Tree endpoint | `GET /api/v1/categories/tree` | Returns 16 departments, each with nested `categories` and `subcategories` |
| 2 | Department CRUD | `POST /api/v1/categories/departments` with `{ name, slug }` | Creates department, returns ID |
| 3 | Category CRUD | `POST /api/v1/categories` with `{ name, slug, departmentId }` | Creates category under department |
| 4 | Subcategory CRUD | `POST /api/v1/categories/subcategories` with `{ name, slug, categoryId }` | Creates subcategory under category |
| 5 | Reorder | `POST /api/v1/categories/reorder?level=department` with `{ items: [{ id, sortOrder }] }` | Updates sort order |
| 6 | Products by department | `GET /api/v1/categories/{deptId}/products` | Returns all products under that department's subcategories |
| 7 | Products by category | `GET /api/v1/categories/{catId}/products` | Returns products under that category's subcategories |
| 8 | Products by subcategory | `GET /api/v1/categories/{subcatId}/products` | Returns products in that subcategory only |

### Products

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 9 | List with subcategory | `GET /api/v1/products?pageSize=5` | Each product has `subcategory: { name }` |
| 10 | Detail with hierarchy | `GET /api/v1/products/{id}` | Product has `subcategory.category.department` nested |
| 11 | Filter by department | `GET /api/v1/products?departmentId={id}` | Only products under that department |
| 12 | Filter by category | `GET /api/v1/products?categoryId={id}` | Only products under that category's subcategories |
| 13 | Filter by subcategory | `GET /api/v1/products?subcategoryId={id}` | Only products in that subcategory |
| 14 | Facets | `GET /api/v1/products/facets` | Returns `subcategories` array with `{ id, name, count }` |
| 15 | Create product | `POST /api/v1/products` with `subcategoryId` field | Product created with correct subcategory |

### Home Feed

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 16 | Home feed | `GET /api/v1/home/{storeId}` | Response has `departments` array (not `categories`), 16 items |
| 17 | Time categories | Check `timeCategories` in home feed | Subcategory-based time sections (morning/afternoon/evening) |

### Store Products

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 18 | Store products list | `GET /api/v1/stores/{storeId}/products` | Returns 2,358 store products |
| 19 | Filter by dept ID | `GET /api/v1/stores/{storeId}/products?categoryId={deptId}` | Only products in that department |
| 20 | Filter by cat ID | `GET /api/v1/stores/{storeId}/products?categoryId={catId}` | Only products in that category |
| 21 | Filter by subcat ID | `GET /api/v1/stores/{storeId}/products?categoryId={subcatId}` | Only products in that subcategory |
| 22 | Product search | `GET /api/v1/stores/{storeId}/products?q=milk` | Search returns relevant products |
| 23 | Substitutes | `GET /api/v1/stores/{storeId}/products/{spId}/substitutes` | Returns products from same/sibling subcategories |

### Banners

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 24 | Create with dept target | Create banner with `departmentId` set | Banner targets a department |
| 25 | Create with cat target | Create banner with `categoryId` set | Banner targets a category |
| 26 | Create with subcat target | Create banner with `subcategoryId` set | Banner targets a subcategory |

---

## Admin Panel Tests

Start admin: `pnpm --filter @martly/admin dev` → http://localhost:7000

### Category Management

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 27 | Category list | Navigate to Categories | Flat table showing departments (blue tag), categories (green), subcategories (default) with depth indentation |
| 28 | Drag reorder | Drag a department row above/below another department | Sort order updates, only within same level/parent |
| 29 | Create department | Click Create → Level = Department → fill name | Department created, slug auto-generated |
| 30 | Create category | Click Create → Level = Category → select department → fill name | Category created under selected department |
| 31 | Create subcategory | Click Create → Level = Subcategory → select department → select category → fill name | Subcategory created under selected category |
| 32 | Edit category | Click edit on any row | Level shown as tag (read-only), name/slug editable, image uploadable |
| 33 | Delete | Click delete on a subcategory | Subcategory deleted |
| 34 | Tree view | Navigate to Category Tree page | 3-level expandable tree: Dept → Cat → Subcat |

### Product Management

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 35 | Product list | Navigate to Products | Table shows product name, subcategory column, variants |
| 36 | Category filter | Click category cascader in filter bar | 3-level dropdown: Dept > Cat > Subcat with product counts |
| 37 | Create product | Click Create → fill name → select category via cascader | 3-level cascader: select Dept > Cat > Subcat, product created with `subcategoryId` |
| 38 | Edit product | Click edit on a product | Category cascader pre-filled with correct Dept > Cat > Subcat path |
| 39 | Product detail | Click show on a product | Category breadcrumb shows "Department → Category → Subcategory" |

### Banner Management

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 40 | Create banner | Action Type = CATEGORY | Target category is a 3-level cascader (can select dept, cat, or subcat) |
| 41 | CATEGORY_TOP targeting | Placement = CATEGORY_TOP | Category targeting field uses 3-level cascader |

---

## Mobile App Tests

Start mobile: `pnpm --filter @martly/mobile dev` → Expo Go on device

### Home Screen

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 42 | Department grid | Open app → home screen | "Shop by Category" shows 16 department cards with icons/images |
| 43 | Department tap | Tap a department | Navigates to `/category/{deptId}` with sidebar |

### Categories Tab

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 44 | Department grid | Tap Categories tab | 3-column grid of 16 departments with icons/images |
| 45 | Expand department | Tap a department card | Expands to show category chips below the row |
| 46 | Category count | Check expanded department | Shows "{N} categories" count on card |
| 47 | Category chip tap | Tap a category chip | Navigates to `/category/{catId}` |
| 48 | Browse All | Tap "Browse All" in expanded panel | Navigates to `/category/{deptId}` |

### Category Detail Screen

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 49 | Department view | Navigate to `/category/{deptId}` | Sidebar shows categories, main area shows all products |
| 50 | Category sidebar | Tap a category in sidebar | Products filter to that category, subcategory pills appear |
| 51 | Subcategory pills | Tap a subcategory pill | Products filter to that subcategory only |
| 52 | Product count | Check sidebar items | Each sidebar item shows product count |
| 53 | Category view | Navigate to `/category/{catId}` | Sidebar shows subcategories |
| 54 | Search within | Type in search box | Filters products by name/brand |
| 55 | Sort & filter | Tap "Price ↑", "On Sale" chips | Products sort/filter correctly |

### Product Detail

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 56 | Category chip | Open any product detail | Shows subcategory name chip |
| 57 | Related products | Scroll to related products | Shows products from same subcategory |
| 58 | Product images | Check product images | Real product photos from S3 (not AI-generated) |

### Store Screen

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 59 | Category filter | Open store page → check category tabs | Categories built from `product.subcategory` |

### Search

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 60 | Category name in title | Navigate via category → search | Screen title shows category name |

---

## Data Verification

| # | Check | Query/Method | Expected |
|---|-------|-------------|----------|
| 61 | Department count | `SELECT COUNT(*) FROM departments` | 16 |
| 62 | Category count | `SELECT COUNT(*) FROM categories` | 87 |
| 63 | Subcategory count | `SELECT COUNT(*) FROM subcategories` | 447 |
| 64 | Brand count | `SELECT COUNT(*) FROM brands` | 485 |
| 65 | Product count | `SELECT COUNT(*) FROM products` | 1,367 |
| 66 | Variant count | `SELECT COUNT(*) FROM product_variants` | 2,358 |
| 67 | Store product count | `SELECT COUNT(*) FROM store_products` | 2,358 |
| 68 | Product images | Check random product `imageUrl` | S3 URL like `https://...s3...amazonaws.com/martly/catalog/...` |
| 69 | Search text | `SELECT search_text FROM products LIMIT 1` | Contains product name + brand + subcategory name |
| 70 | No orphan products | `SELECT COUNT(*) FROM products WHERE subcategory_id IS NULL` | Should be low or 0 (some products may legitimately have no subcategory) |

---

## Store & Auth Info

- **Store ID**: `5cb06e5d-10b9-40ad-b42b-e7e1e9dbccbf` (Downtown Mart)
- **Admin login**: `admin@martly.dev` / `admin123`
- **Mobile OTP**: any 10-digit phone, OTP = `111111`
