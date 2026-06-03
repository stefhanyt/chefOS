export type StatusType = "critical" | "low" | "ok" | "blue" | "warning"

export type PantryStatus = "Out of Stock" | "Critical" | "Low" | "OK"
export type MealStatus = "Expired" | "Use Soon" | "Fresh"
export type ShoppingStatus = "Open" | "Purchased" | "Archived"
export type MemberRole = "admin" | "manager" | "staff" | "viewer"
export type ScanMode = "single" | "batch" | "photo"
export type Priority = "Normal" | "Important" | "Urgent"

export interface Profile {
  id: string
  display_name: string
  email: string
  role: "admin" | "user"
  created_at: string
  updated_at: string
}

export interface Home {
  id: string
  owner_id: string
  name: string
  location: string
  notes?: string
  private_notes?: string | null
  team_notes?: string | null
  kitchen_equipment?: string
  preferences?: string
  created_at: string
  updated_at: string
  archived_at?: string | null
  // computed
  pantry_alert_count?: number
  open_shopping_count?: number
  expiring_meal_count?: number
  member_count?: number
}

export interface HomeMember {
  id: string
  home_id: string
  user_id: string
  role: MemberRole
  can_edit_pantry: boolean
  can_add_shopping_items: boolean
  can_log_meals: boolean
  can_manage_team?: boolean
  can_edit_menu?: boolean
  can_archive_residence?: boolean
  can_use_scan?: boolean
  can_manage_dish_repertoire?: boolean
  invited_by: string
  created_at: string
  removed_at?: string | null
  // joined
  profile?: Profile
  home?: Home
}

export interface PantryItem {
  id: string
  home_id: string
  created_by: string
  name: string
  category: string
  quantity: number
  unit: string
  minimum_quantity: number
  preferred_brand?: string
  storage_location: string
  notes?: string
  barcode?: string | null
  status: PantryStatus
  created_at: string
  updated_at: string
  archived_at?: string | null
  // joined
  home?: Home
}

export interface ShoppingItem {
  id: string
  home_id: string
  pantry_item_id?: string | null
  name: string
  quantity_needed: string
  category: string
  store?: string
  priority: Priority
  notes?: string
  added_by: string
  assigned_to?: string | null
  status: ShoppingStatus
  created_at: string
  completed_at?: string | null
  archived_at?: string | null
  // joined
  home?: Home
  added_by_profile?: Profile
  assigned_to_profile?: Profile | null
}

export interface ResidenceActivity {
  id: string
  home_id: string
  user_id: string | null
  summary: string
  created_at: string
}

export interface DishLibraryItem {
  id: string
  created_by: string
  name: string
  category: string
  ingredients: string
  prep_time: string
  storage_instructions: string
  reheating_instructions: string
  tags: string[]
  notes?: string
  description?: string | null
  meal_category?: string | null
  cuisine_style?: string | null
  dietary_tags?: string[]
  instructions?: string | null
  default_servings?: number
  is_active?: boolean
  residence_notes?: Record<string, string> | null
  created_at: string
  updated_at: string
  archived_at?: string | null
  dish_ingredients?: DishIngredient[]
}

export interface DishIngredient {
  id: string
  dish_id: string
  sort_order: number
  name: string
  quantity: number
  unit?: string | null
  category?: string | null
  notes?: string | null
  created_at: string
}

export interface PreparedMeal {
  id: string
  home_id: string
  dish_id?: string | null
  created_by: string
  name: string
  prepared_date: string
  expiry_date: string
  portions: number
  storage_location: string
  reheating_instructions: string
  notes?: string
  client_feedback?: string
  status: MealStatus
  created_at: string
  updated_at: string
  archived_at?: string | null
  // joined
  home?: Home
}

export interface WeeklyMenu {
  id: string
  home_id: string
  created_by: string
  week_start: string
  status: "draft" | "confirmed"
  created_at: string
  updated_at: string
}

export interface MenuItemRow {
  id: string
  menu_id: string
  dish_id?: string | null
  day_of_week: number
  category: string
  dish_name: string
  portions: number
  notes?: string | null
  created_at: string
}

export interface BarcodeScan {
  id: string
  home_id: string
  user_id: string
  barcode: string
  product_name: string
  quantity: number
  unit: string
  storage_location: string
  scan_mode: ScanMode
  created_at: string
}

export interface ProductCatalog {
  id: string
  barcode: string
  product_name: string
  brand?: string | null
  default_quantity?: number | null
  default_unit?: string | null
  default_category?: string | null
  notes?: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface OpenFoodFactsProduct {
  product_name?: string
  brands?: string
  categories?: string
  quantity?: string
  image_url?: string
  nutriments?: Record<string, number>
}
