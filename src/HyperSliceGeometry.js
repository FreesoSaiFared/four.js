import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Color } from 'three'
import { cellColors } from './colorGenerators'

export default class HyperSliceGeometry {
  constructor(
    shape,
    hyperRenderer,
    {
      useColors = false,
      colorGenerator = cellColors,
      useFaces = true,
      useEdges = false,
      usePoints = false,
      colors = new Array(128)
        .fill()
        .map((_, i) => `hsl(${(i * 29) % 360}, 60%, 60%)`),
    } = {}
  ) {
    this.shape = shape
    this.hyperRenderer = hyperRenderer
    const { cells } = this.shape
    this.useColors = useColors
    this.useFaces = useFaces
    this.useEdges = useEdges
    this.usePoints = usePoints
    this.colors = colors.map(color => new Color(color))
    this.colorGenerator = colorGenerator

    const maxPositions = 2 * cells.reduce((rv, c) => rv + c.length, 0)

    if (this.useFaces) {
      this.geometry = this.initGeometry(maxPositions)
    }
    if (this.useEdges) {
      this.edgeGeometry = this.initGeometry(maxPositions)
    }
    if (this.usePoints) {
      this.pointGeometry = this.initGeometry(maxPositions)
    }

    this.update()
  }

  initGeometry(size) {
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(3 * size), 3).setUsage(
        DynamicDrawUsage
      )
    )
    if (this.useColors) {
      geometry.setAttribute(
        'color',
        new BufferAttribute(new Float32Array(3 * size), 3).setUsage(
          DynamicDrawUsage
        )
      )
    }
    return geometry
  }

  update() {
    const { vertices, faces, cells } = this.shape
    const epsilon = 1e-8
    let i = 0
    const indices = []
    const edgeIndices = []
    cells.forEach((cell, cellIndex) => {
      const colorGetter = this.useColors
        ? this.colorGenerator({
            shape: this.shape,
            colors: this.colors,
          })
        : null

      const pairs = []
      cell
        .map(faceIndex => faces[faceIndex])
        .forEach(face => {
          const pair = face
            .map((verticeIndex, faceVerticeIndex) => [
              vertices[verticeIndex],
              vertices[face[(faceVerticeIndex + 1) % face.length]],
            ])
            .map(([p1, p2]) => this.hyperRenderer.slice(p1, p2))
            .filter(x => x)
          pair.length > 1 && pairs.push(pair)
        })
      if (pairs.length > 2) {
        const linkedPairs = []
        linkedPairs.push(...pairs.shift())
        while (pairs.length) {
          const lp = pairs.length
          const dangle = linkedPairs.slice(-1)[0]
          for (let pairIndex = 0; pairIndex < pairs.length; pairIndex++) {
            const [p1, p2] = pairs[pairIndex]
            if (p1.every((c, ci) => Math.abs(c - dangle[ci]) < epsilon)) {
              pairs.splice(pairIndex, 1)
              linkedPairs.push(p2)
              break
            }
            if (p2.every((c, ci) => Math.abs(c - dangle[ci]) < epsilon)) {
              pairs.splice(pairIndex, 1)
              linkedPairs.push(p1)
              break
            }
          }
          if (lp === pairs.length) {
            // console.log(lp, cell)
            return
          }
        }

        if (this.useFaces) {
          new Array(linkedPairs.length - 2).fill().forEach((_, j) => {
            indices.push(i, i + j + 1, i + j + 2)
          })
        }

        if (this.useEdges) {
          new Array(linkedPairs.length).fill().forEach((_, j) => {
            edgeIndices.push(i + j, i + ((j + 1) % linkedPairs.length))
          })
        }

        linkedPairs.forEach(([x, y, z], pairIndex) => {
          if (this.useFaces) {
            if (this.useColors) {
              const [r, g, b] = colorGetter({
                cell: cellIndex,
                pair: pairIndex,
                point: [x, y, z],
                type: 'face-pair',
              }).toArray()
              this.geometry.attributes.color.array[3 * i] = r
              this.geometry.attributes.color.array[3 * i + 1] = g
              this.geometry.attributes.color.array[3 * i + 2] = b
            }
            this.geometry.attributes.position.array[3 * i] = x
            this.geometry.attributes.position.array[3 * i + 1] = y
            this.geometry.attributes.position.array[3 * i + 2] = z
          }
          if (this.useEdges) {
            if (this.useColors) {
              const [r, g, b] = colorGetter({
                cell: cellIndex,
                pair: pairIndex,
                point: [x, y, z],
                type: 'edge-pair',
              }).toArray()
              this.edgeGeometry.attributes.color.array[3 * i] = r
              this.edgeGeometry.attributes.color.array[3 * i + 1] = g
              this.edgeGeometry.attributes.color.array[3 * i + 2] = b
            }
            this.edgeGeometry.attributes.position.array[3 * i] = x
            this.edgeGeometry.attributes.position.array[3 * i + 1] = y
            this.edgeGeometry.attributes.position.array[3 * i + 2] = z
          }
          if (this.usePoints) {
            if (this.useColors) {
              const [r, g, b] = colorGetter({
                cell: cellIndex,
                pair: pairIndex,
                point: [x, y, z],
                type: 'vertex-pair',
              }).toArray()
              this.pointGeometry.attributes.color.array[3 * i] = r
              this.pointGeometry.attributes.color.array[3 * i + 1] = g
              this.pointGeometry.attributes.color.array[3 * i + 2] = b
            }
            this.pointGeometry.attributes.position.array[3 * i] = x
            this.pointGeometry.attributes.position.array[3 * i + 1] = y
            this.pointGeometry.attributes.position.array[3 * i + 2] = z
          }
          i++
        })
      }
    })
    if (this.useFaces) {
      this.geometry.setIndex(indices)
      this.geometry.attributes.position.needsUpdate = true
      if (this.useColors) {
        this.geometry.attributes.color.needsUpdate = true
      }
      this.geometry.computeVertexNormals()
      this.geometry.attributes.normal.needsUpdate = true
    }
    if (this.useEdges) {
      this.edgeGeometry.setIndex(edgeIndices)
      this.edgeGeometry.attributes.position.needsUpdate = true
      if (this.useColors) {
        this.edgeGeometry.attributes.color.needsUpdate = true
      }
    }
    if (this.usePoints) {
      this.pointGeometry.setDrawRange(0, i)
      this.pointGeometry.attributes.position.needsUpdate = true
      if (this.useColors) {
        this.pointGeometry.attributes.color.needsUpdate = true
      }
    }
  }
}
