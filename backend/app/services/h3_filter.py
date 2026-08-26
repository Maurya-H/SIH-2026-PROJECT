import h3


def get_h3_index(latitude: float, longitude: float, resolution: int = 9) -> str:
    """
    Converts a lat/lng point into an H3 cell index.
    Resolution 9 ≈ ~0.1 sq km per cell — good balance for city-level filtering.
    """
    return h3.latlng_to_cell(latitude, longitude, resolution)


def get_polygon_h3_cells(coordinates, resolution: int = 9):
    """
    Given a polygon (list of [lng, lat] pairs), returns the set of H3 cells
    that cover it. Used to quickly narrow down candidate incidents
    before running the precise PostGIS ST_Within check.
    """
    # h3 expects [lat, lng] pairs for polygon input
    latlng_coords = [[lat, lng] for lng, lat in coordinates]
    h3_shape = h3.LatLngPoly(latlng_coords)
    cells = h3.polygon_to_cells(h3_shape, resolution)
    return list(cells)