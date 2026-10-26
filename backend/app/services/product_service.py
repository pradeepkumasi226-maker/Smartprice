from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..models.product import Product
from ..schemas.product import ProductCreate, ProductUpdate

def compute_stock_status(stock: int, reorder: int, safety: int) -> str:
    if stock <= safety:
        return "Critical"
    elif stock <= reorder:
        return "Low Stock"
    elif stock > (reorder * 3.5):
        return "Overstocked"
    return "Optimal"

class ProductService:
    @staticmethod
    def get_products(
        db: Session,
        search: Optional[str] = None,
        category: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[dict]:
        query = db.query(Product)

        if search:
            s = f"%{search.strip()}%"
            query = query.filter(or_(Product.name.ilike(s), Product.sku.ilike(s), Product.category.ilike(s)))

        if category and category.lower() != "all":
            query = query.filter(Product.category == category)

        products = query.order_by(Product.name).all()
        results = []

        for p in products:
            st = compute_stock_status(p.stock_quantity, p.reorder_level, p.safety_stock)
            if status and status.lower() != "all":
                if status.lower() in ("in stock", "optimal"):
                    if st.lower() not in ("in stock", "optimal"):
                        continue
                elif st.lower() != status.lower():
                    continue

            # Check latest recommended price
            rec_price = None
            if p.pricing_recommendations:
                rec_price = p.pricing_recommendations[0].recommended_price

            results.append({
                "id": p.id,
                "sku": p.sku,
                "name": p.name,
                "category": p.category,
                "current_price": p.current_price,
                "cost_price": p.cost_price,
                "competitor_price": p.competitor_price,
                "stock_quantity": p.stock_quantity,
                "reorder_level": p.reorder_level,
                "safety_stock": p.safety_stock,
                "supplier": p.supplier,
                "rating": p.rating,
                "elasticity": p.elasticity,
                "predicted_demand": p.predicted_demand,
                "dynamic_pricing": bool(p.dynamic_pricing if p.dynamic_pricing is not None else True),
                "status": st,
                "recommended_price": rec_price or round(p.current_price * 1.08, 2),
                "created_at": p.created_at,
                "updated_at": p.updated_at
            })

        return results

    @staticmethod
    def get_product_by_sku(db: Session, sku: str) -> Optional[dict]:
        p = db.query(Product).filter(or_(Product.sku == sku, Product.id == sku)).first()
        if not p:
            return None
        st = compute_stock_status(p.stock_quantity, p.reorder_level, p.safety_stock)
        rec_price = p.pricing_recommendations[0].recommended_price if p.pricing_recommendations else round(p.current_price * 1.08, 2)
        return {
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "category": p.category,
            "current_price": p.current_price,
            "cost_price": p.cost_price,
            "competitor_price": p.competitor_price,
            "stock_quantity": p.stock_quantity,
            "reorder_level": p.reorder_level,
            "safety_stock": p.safety_stock,
            "supplier": p.supplier,
            "rating": p.rating,
            "elasticity": p.elasticity,
            "predicted_demand": p.predicted_demand,
            "dynamic_pricing": bool(p.dynamic_pricing if p.dynamic_pricing is not None else True),
            "status": st,
            "recommended_price": rec_price,
            "created_at": p.created_at,
            "updated_at": p.updated_at
        }

    @staticmethod
    def create_product(db: Session, data: ProductCreate) -> dict:
        import time
        pid = f"prod-{int(time.time()) % 10000:04d}"
        product = Product(
            id=pid,
            sku=data.sku,
            name=data.name,
            category=data.category,
            current_price=data.current_price,
            cost_price=data.cost_price,
            competitor_price=data.competitor_price or round(data.current_price * 1.05, 2),
            stock_quantity=data.stock_quantity,
            reorder_level=data.reorder_level,
            safety_stock=data.safety_stock,
            supplier=data.supplier or "Global Direct Vendor Ltd.",
            rating=data.rating or 4.5,
            elasticity=data.elasticity or -1.25,
            predicted_demand=data.predicted_demand or 100,
            dynamic_pricing=data.dynamic_pricing if data.dynamic_pricing is not None else True
        )
        db.add(product)
        db.commit()
        db.refresh(product)
        return ProductService.get_product_by_sku(db, product.sku)

    @staticmethod
    def update_product(db: Session, sku: str, data: ProductUpdate) -> Optional[dict]:
        product = db.query(Product).filter(or_(Product.sku == sku, Product.id == sku)).first()
        if not product:
            return None

        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            if hasattr(product, key) and value is not None:
                setattr(product, key, value)

        db.commit()
        db.refresh(product)
        return ProductService.get_product_by_sku(db, product.sku)

    @staticmethod
    def delete_product(db: Session, sku: str) -> bool:
        product = db.query(Product).filter(or_(Product.sku == sku, Product.id == sku)).first()
        if not product:
            return False
        db.delete(product)
        db.commit()
        return True

    @staticmethod
    def batch_delete_products(db: Session, skus_or_ids: List[str]) -> List[str]:
        deleted = []
        for item in skus_or_ids:
            product = db.query(Product).filter(or_(Product.sku == item, Product.id == item)).first()
            if product:
                deleted.append(product.sku)
                db.delete(product)
        if deleted:
            db.commit()
        return deleted

    @staticmethod
    def batch_apply_ai_prices(db: Session, skus_or_ids: List[str]) -> List[dict]:
        from .pricing_service import PricingService
        updated = []
        for item in skus_or_ids:
            product = db.query(Product).filter(or_(Product.sku == item, Product.id == item)).first()
            if product:
                rec_data = PricingService.calculate_product_recommendation(product=product)
                rec_price = rec_data.get("recommended_price") or round(product.current_price * 1.05, 2)
                try:
                    res = PricingService.approve_recommendation(
                        db=db,
                        sku_or_id=product.sku,
                        approved_price=rec_price,
                        user="Batch AI Process",
                        allow_below_cost=False
                    )
                    if res and res.get("product"):
                        updated.append(res["product"])
                except Exception as e:
                    print(f"Batch AI price failed for {product.sku}: {e}")
        return updated
