-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
CREATE INDEX IF NOT EXISTS idx_categories_created_at ON categories(created_at);

-- Add RLS (Row Level Security) policies if needed
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to read categories
CREATE POLICY "Allow authenticated users to read categories" 
ON categories FOR SELECT 
TO authenticated 
USING (true);

-- Policy to allow authenticated users to insert categories
CREATE POLICY "Allow authenticated users to insert categories" 
ON categories FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Policy to allow authenticated users to update categories
CREATE POLICY "Allow authenticated users to update categories" 
ON categories FOR UPDATE 
TO authenticated 
USING (true);

-- Policy to allow authenticated users to delete categories
CREATE POLICY "Allow authenticated users to delete categories" 
ON categories FOR DELETE 
TO authenticated 
USING (true);

-- Insert some default categories
INSERT INTO categories (name, description) VALUES 
('Supermarket', 'General supermarket products and promotions'),
('Grocery', 'Grocery store items and daily essentials'),
('Electronics', 'Electronic devices and accessories'),
('Fashion', 'Clothing and fashion accessories'),
('Home & Garden', 'Home improvement and garden supplies'),
('Food & Beverage', 'Food products and beverages'),
('Health & Beauty', 'Health care and beauty products'),
('Sports & Fitness', 'Sports equipment and fitness gear'),
('Books & Media', 'Books, movies, and media content'),
('Toys & Games', 'Toys and gaming products')
ON CONFLICT (name) DO NOTHING;
