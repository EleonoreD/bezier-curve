

function v2 (x, y) {
	return {
		x: x || 0,
		y: y || 0
	};
}
v2.add = function (lhs, rhs) {
	return v2(lhs.x + rhs.x, lhs.y + rhs.y);
};
v2.sub = function (lhs, rhs) {
	return v2(lhs.x - rhs.x, lhs.y - rhs.y);
};
v2.mul = function (v, scaling) {
	return v2(v.x * scaling, v.y * scaling);
};
v2.div = function (v, scaling) {
	return v2(v.x / scaling, v.y / scaling);
};
v2.lerp = function (from, to, ratio) {
	return v2(from.x + (to.x - from.x) * ratio, from.y + (to.y - from.y) * ratio);
};
v2.sqrDistance = function (lhs, rhs) {
	var dx = lhs.x - rhs.x;
	var dy = lhs.y - rhs.y;
	return dx * dx + dy * dy;
};
v2.distance = function (lhs, rhs) {
	return Math.sqrt(v2.sqrDistance(lhs, rhs));
};
v2.dir = function (lhs, rhs) {
	var len = v2.distance(v2, {x: 0, y: 0});
	return v2(v2.x / len, v2.y / len);
};
function Curve (points) {
	this.points = points || [];
	this.beziers = [];
	this.ratios = [];
	this.progresses = [];
	this.length = 0;
	this.computeBeziers();
}


Curve.prototype.computeBeziers = function () {
	this.beziers.length = 0;
	this.ratios.length = 0;
	this.progresses.length = 0;
	this.length = 0;
	for (var i = 1; i < this.points.length; i++) {
		var startPoint = this.points[i - 1];
		var endPoint = this.points[i];
		var bezier = new Bezier();
		bezier.start = startPoint.pos;
		bezier.startCtrlPoint = startPoint.out;
		bezier.end = endPoint.pos;
		bezier.endCtrlPoint = endPoint.in;
		this.beziers.push(bezier);
		this.length += bezier.getLength();
	}
	var current = 0;
	for (var i = 0; i < this.beziers.length; i++) {
		var bezier = this.beziers[i];
		this.ratios[i] = bezier.getLength() / this.length;
		this.progresses[i] = current = current + this.ratios[i];
	}
	return this.beziers;
};


function Bezier () {
	this.start = v2();
	this.end = v2();
	this.startCtrlPoint = v2(); // cp0, cp1
	this.endCtrlPoint = v2();   // cp2, cp3
}
// Get point at relative position in curve according to arc length
// - u [0 .. 1]
Bezier.prototype.getPointAt = function ( u ) {
	var t = this.getUtoTmapping( u );
	return this.getPoint( t );
};
function bezierAt (C1, C2, C3, C4, t) {
	var t1 = 1 - t;
	return C1 * t1 * t1 * t1 +
			C2 * 3 * t1 * t1 * t +
			C3 * 3 * t1 * t * t +
			C4 * t * t * t;
}
// Get point at time t
//  - t [0 .. 1]
Bezier.prototype.getPoint = function ( t ) {
	var x = bezierAt(this.start.x, this.startCtrlPoint.x, this.endCtrlPoint.x, this.end.x, t);
	var y = bezierAt(this.start.y, this.startCtrlPoint.y, this.endCtrlPoint.y, this.end.y, t);
	return new v2(x, y);
};
// Get total curve arc length
Bezier.prototype.getLength = function () {
	var lengths = this.getLengths();
	return lengths[ lengths.length - 1 ];
};
// Get list of cumulative segment lengths
Bezier.prototype.getLengths = function ( divisions ) {
	if ( ! divisions ) divisions = (this.__arcLengthDivisions) ? (this.__arcLengthDivisions): 200;
	if ( this.cacheArcLengths
		&& ( this.cacheArcLengths.length === divisions + 1 )) {
		//console.log( "cached", this.cacheArcLengths );
		return this.cacheArcLengths;
	}
	var cache = [];
	var current, last = this.getPoint( 0 );
	var p, sum = 0;
	cache.push( 0 );
	for ( p = 1; p <= divisions; p ++ ) {
		current = this.getPoint ( p / divisions );
		sum += v2.distance(current, last);
		cache.push( sum );
		last = current;
	}
	this.cacheArcLengths = cache;
	return cache; // { sums: cache, sum:sum }; Sum is in the last element.
};
Bezier.prototype.getUtoTmapping = function ( u, distance ) {
	var arcLengths = this.getLengths();
	var i = 0, il = arcLengths.length;
	var targetArcLength; // The targeted u distance value to get
	if ( distance ) {
		targetArcLength = distance;
	} else {
		targetArcLength = u * arcLengths[ il - 1 ];
	}
	//var time = Date.now();
	// binary search for the index with largest value smaller than target u distance
	var low = 0, high = il - 1, comparison;
	while ( low <= high ) {
		i = Math.floor( low + ( high - low ) / 2 ); // less likely to overflow, though probably not issue here, JS doesn't really have integers, all numbers are floats
		comparison = arcLengths[ i ] - targetArcLength;
		if ( comparison < 0 ) {
			low = i + 1;
			continue;
		} else if ( comparison > 0 ) {
			high = i - 1;
			continue;
		} else {
			high = i;
			break;
			// DONE
		}
	}
	i = high;
	//console.log('b' , i, low, high, Date.now()- time);
	if ( arcLengths[ i ] == targetArcLength ) {
		var t = i / ( il - 1 );
		return t;
	}
	// we could get finer grain at lengths, or use simple interpolatation between two points
	var lengthBefore = arcLengths[ i ];
	var lengthAfter = arcLengths[ i + 1 ];
	var segmentLength = lengthAfter - lengthBefore;
	// determine where we are between the 'before' and 'after' points
	var segmentFraction = ( targetArcLength - lengthBefore ) / segmentLength;
	// add that fractional amount to t
	var t = ( i + segmentFraction ) / ( il -1 );
	return t;
};