INSERT INTO incidents (category, description, location, h3_index, status, reported_by)
VALUES
('waterlogging', 'Ankle-deep water near market road', ST_GeogFromText('POINT(80.9462 26.8467)'), '8a2a1072b59ffff', 'verified', 'citizen_demo'),
('pothole', 'Large pothole causing traffic', ST_GeogFromText('POINT(80.9470 26.8475)'), '8a2a1072b5affff', 'pending', 'citizen_demo'),
('fallen_tree', 'Tree blocking half the road after storm', ST_GeogFromText('POINT(80.9450 26.8460)'), '8a2a1072b5bffff', 'verified', 'citizen_demo');