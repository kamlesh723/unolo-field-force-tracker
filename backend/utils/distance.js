// Converts degree to radian
const toRad = (value)=>(value*Math.PI)/180;


// Calculates distance between two geographic coordinates using
//  the Haversine formula.
//  lat1,lat2 Latitude of point A,B
//  lon1 ,lon2 Longitude of point A,B

const calculateDistanceKm = (lat1,lon1,lat2,lon2)=>{
    const R = 6371;// earth radius in km

    const dLat = toRad(lat2-lat1);
    const dLon = toRad(lon2-lon1);

    const a = Math.sin(dLat/2)* Math.sin(dLat/2)+ Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)* Math.sin(dLon/2);

    const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return Number((R*c).toFixed(2));
}

module.exports = {calculateDistanceKm}