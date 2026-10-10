import { Router } from "express";
import { body } from "express-validator";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  addReview,
} from "../controllers/productController";
import { getCategories, createCategory } from "../controllers/categoryController";
import { authenticate, authorize } from "../middlewares/auth";
import { upload } from "../utils/cloudinary";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/products", asyncHandler(getProducts));
router.get("/products/:id", asyncHandler(getProductById));

router.post(
  "/products",
  authenticate,
  authorize("ADMIN"),
  upload.array("images", 5),
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("slug").notEmpty().withMessage("Slug is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("price").isFloat({ min: 0 }).withMessage("Price must be positive"),
    body("stock").isInt({ min: 0 }).withMessage("Stock must be non-negative"),
    body("categoryId").notEmpty().withMessage("Category is required"),
  ],
  asyncHandler(createProduct)
);

router.put(
  "/products/:id",
  authenticate,
  authorize("ADMIN"),
  upload.array("images", 5),
  asyncHandler(updateProduct)
);

router.delete(
  "/products/:id",
  authenticate,
  authorize("ADMIN"),
  asyncHandler(deleteProduct)
);

router.post(
  "/products/:id/reviews",
  authenticate,
  [
    body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be 1-5"),
    body("comment").notEmpty().withMessage("Comment is required"),
  ],
  asyncHandler(addReview)
);

router.get("/categories", asyncHandler(getCategories));
router.post(
  "/categories",
  authenticate,
  authorize("ADMIN"),
  [body("name").notEmpty(), body("slug").notEmpty()],
  asyncHandler(createCategory)
);

export default router;
