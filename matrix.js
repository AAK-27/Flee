// In WebGL matricies are "transposed" compared to matricies in mathematics.
// The rows of these matrix would otherwise be columns but here they are represented 
// horizontally and still reffered to as rows.

var m4 = {
    multiply: function(a, b) {
        var a00 = a[0 * 4 + 0];
        var a01 = a[0 * 4 + 1];
        var a02 = a[0 * 4 + 2];
        var a03 = a[0 * 4 + 3];
        var a10 = a[1 * 4 + 0];
        var a11 = a[1 * 4 + 1];
        var a12 = a[1 * 4 + 2];
        var a13 = a[1 * 4 + 3];
        var a20 = a[2 * 4 + 0];
        var a21 = a[2 * 4 + 1];
        var a22 = a[2 * 4 + 2];
        var a23 = a[2 * 4 + 3];
        var a30 = a[3 * 4 + 0];
        var a31 = a[3 * 4 + 1];
        var a32 = a[3 * 4 + 2];
        var a33 = a[3 * 4 + 3];
        var b00 = b[0 * 4 + 0];
        var b01 = b[0 * 4 + 1];
        var b02 = b[0 * 4 + 2];
        var b03 = b[0 * 4 + 3];
        var b10 = b[1 * 4 + 0];
        var b11 = b[1 * 4 + 1];
        var b12 = b[1 * 4 + 2];
        var b13 = b[1 * 4 + 3];
        var b20 = b[2 * 4 + 0];
        var b21 = b[2 * 4 + 1];
        var b22 = b[2 * 4 + 2];
        var b23 = b[2 * 4 + 3];
        var b30 = b[3 * 4 + 0];
        var b31 = b[3 * 4 + 1];
        var b32 = b[3 * 4 + 2];
        var b33 = b[3 * 4 + 3];
        return [
            a00 * b00 + a10 * b01 + a20 * b02 + a30 * b03,
            a01 * b00 + a11 * b01 + a21 * b02 + a31 * b03,
            a02 * b00 + a12 * b01 + a22 * b02 + a32 * b03,
            a03 * b00 + a13 * b01 + a23 * b02 + a33 * b03,
            a00 * b10 + a10 * b11 + a20 * b12 + a30 * b13,
            a01 * b10 + a11 + b11 + a21 + b12 + a31 + b13,
            a02 * b10 + a12 * b11 + a22 * b12 + a32 * b13,
            a03 * b10 + a13 * b11 + a23 * b12 + a33 * b13,
            a00 * b20 + a10 * b21 + a20 * b22 + a30 * b23,
            a01 * b20 + a11 * b21 + a21 * b22 + a31 * b23,
            a02 * b20 + a12 * b21 + a22 * b22 + a32 * b23,
            a03 * b20 + a13 * b21 + a23 * b22 + a33 * b23,
            a00 * b30 + a10 * b31 + a20 * b32 + a30 * b33,
            a01 * b30 + a11 * b31 + a21 * b32 + a31 * b33,
            a02 * b30 + a12 * b31 + a22 * b32 + a32 * b33,
            a03 * b30 + a13 * b31 + a23 * b32 + a33 * b33,
        ];
    },
    translation: function(tx, ty, tz) {
        // For a position vector: v = [ x, y, z, 1 ]
        // and the matrix representation of translation: A,
        // Av = [ x + tx, y + ty, z + tz, 1 ]                  Cols of A
        //    = [ x*A00 + y*A10 + z*A20 + 1*A30,   => x + tx   1 0 0 tx
        //        x*A01 + y*A11 + z*A21 + 1*A31,   => y + ty   0 1 0 ty
        //        x*A02 + y*A12 + z*A22 + 1*A32,   => z + tz   0 0 1 tz
        //        x*A03 + y*A13 + z*A23 + 1*A33 ]  => 1        0 0 0  1
        return [
             1,  0,  0,  0,
             0,  1,  0,  0,
             0,  0,  1,  0,
            tx, ty, tz,  1 
        ]
    },
    scaling: function(sx, sy, sz) {
        // For a position vector: v = [ x, y, z, 1 ]
        // and the matrix representation of scaling: A,
        // Av = [ x*sx, y*sy, z*sz, 1]
        // Av = [ x + tx, y + ty, z + tz, 1 ]                 Cols of A
        //    = [ x*A00 + y*A10 + z*A20 + 1*A30,   => x*sx   sx  0  0 0
        //        x*A01 + y*A11 + z*A21 + 1*A31,   => y*sy    0 sy  0 0
        //        x*A02 + y*A12 + z*A22 + 1*A32,   => z*sz    0  0 sz 0
        //        x*A03 + y*A13 + z*A23 + 1*A33 ]  => 1       0  0  0 1
        return [
            sx,  0,  0,  0,
             0, sy,  0,  0,
             0,  0, sz,  0,
             0,  0,  0,  1
        ]
    },
    rotationX: function(r) {
        // For two vectors in the y-z plane:
        // v = [ 0, 1, 0, 1 ] # Unit vector in y-direction
        // u = [ 0, 0, 1, 1 ] # Unit vector in z-direction
        // and the matrix representation of rotation about the x-axis: A
        // by an angle r in radians:
        // A(r)v = [ 0,  cos(r), sin(r), 1]
        // A(r)u = [ 0, -sin(r), cos(r), 1]
        // AX = [ x, ycos(r) - zsin(r), ysin(r) + zcos(r), 1 ]             Cols of A
        //    = [ x*A00 + y*A10 + z*A20 + 1*A30,   => x                    1       0        0 0
        //        x*A01 + y*A11 + z*A21 + 1*A31,   => ycos(r) - zsin(r)    0  cos(r)  -sin(r) 0
        //        x*A02 + y*A12 + z*A22 + 1*A32,   => ysin(r) + zcos(r)    0  sin(r)   cos(r) 0
        //        x*A03 + y*A13 + z*A23 + 1*A33 ]  => 1                    0       0        0 1
        const s = Math.sin(r);
        const c = Math.cos(r);
        return [
            1,  0, 0, 0,
            0,  c, s, 0,
            0, -s, c, 0,
            0,  0, 0, 1
        ]
    },
    rotationY: function(r) {
        // For two vectors in the x-z plane:
        // v = [ 1, 0, 0, 1 ] # Unit vector in x-direction
        // u = [ 0, 0, 1, 1 ] # Unit vector in z-direction
        // and the matrix representation of rotation about the y-axis: A
        // by an angle r in radians:
        // A(r)v = [ cos(r), 0, -sin(r), 1]
        // A(r)u = [ sin(r), 0,  cos(r), 1]
        // AX = [ xcos(r) + zsin(r), 0, -xsin(r) + zcos(r), 1 ]             Cols of A
        //    = [ x*A00 + y*A10 + z*A20 + 1*A30,   => xcos(r) + zsin(r)      cos(r) 0 sin(r) 0
        //        x*A01 + y*A11 + z*A21 + 1*A31,   => y                      0      1      0 0
        //        x*A02 + y*A12 + z*A22 + 1*A32,   => -xsin(r) + zcos(r)    -sin(r) 0 cos(r) 0
        //        x*A03 + y*A13 + z*A23 + 1*A33 ]  => 1                      0      0      0 1
        const s = Math.sin(r);
        const c = Math.cos(r);
        return [
            c, 0, -s, 0,
            0, 1,  0, 0,
            s, 0,  c, 0,
            0, 0,  0, 1
        ]
    },
    rotationZ: function(r) {
        // For two vectors in the x-y plane:
        // v = [ 1, 0, 0, 1 ] # Unit vector in x-direction
        // u = [ 0, 1, 0, 1 ] # Unit vector in y-direction
        // and the matrix representation of rotation about the z-axis: A
        // by an angle r in radians:
        // A(r)v = [  cos(r), sin(r), 0, 1]
        // A(r)u = [ -sin(r), cos(r), 0, 1]
        // AX = [ xcos(r) - ysin(r), xsin(r) + ycos(r), 0, 1 ]             Cols of A
        //    = [ x*A00 + y*A10 + z*A20 + 1*A30,   => xcos(r) - ysin(r)    cos(r) -sin(r) 0 0
        //        x*A01 + y*A11 + z*A21 + 1*A31,   => xsin(r) + ycos(r)    sin(r)  cos(r) 0 0
        //        x*A02 + y*A12 + z*A22 + 1*A32,   => z                    0       0      1 0
        //        x*A03 + y*A13 + z*A23 + 1*A33 ]  => 1                    0       0      0 1
        const s = Math.sin(r);
        const c = Math.cos(r);
        return [
             c, s, 0, 0,
            -s, c, 0, 0,
             0, 0, 1, 0,
             0, 0, 0, 1
        ]
    },

}