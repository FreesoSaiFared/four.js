import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Color } from 'three'
import { cellColors } from './colorGenerators'

export default class HyperGeometry {
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
    this.useColors = useColors
    this.useFaces = useFaces
    this.useEdges = useEdges
    this.usePoints = usePoints
    this.colors = colors.map(color => new Color(color))
    this.colorGenerator = colorGenerator

    this.vertexGeometriesIndices = []
    this.dedupVertexGeometriesIndices = []
    this.shape.cells.map(cell => {
      const faces = cell.map(faceIndex => this.shape.faces[faceIndex])
      const verticesIndices = faces.flat()
      this.vertexGeometriesIndices.push(verticesIndices)
      this.dedupVertexGeometriesIndices.push([...new Set(verticesIndices)])
    })

    if (this.useFaces) {
      this.geometries = this.vertexGeometriesIndices.map(verticesIndices =>
        this.initGeometry(verticesIndices.length)
      )
      this.geometries.forEach((geometry, i) => {
        const faces = this.shape.cells[i].map(
          faceIndex => this.shape.faces[faceIndex]
        )
        const indices = []
        let faceShift = 0
        faces.forEach(face => {
          // Tesselate face
          new Array(face.length - 2).fill().forEach((_, i) => {
            indices.push(faceShift, faceShift + i + 1, faceShift + i + 2)
          })

          faceShift += face.length
        })
        geometry.setIndex(indices)
      })
    }

    if (this.useEdges) {
      this.edgesGeometries = this.dedupVertexGeometriesIndices.map(
        verticesIndices => this.initGeometry(verticesIndices.length)
      )
      this.edgesGeometries.forEach((geometry, i) => {
        const faces = this.shape.cells[i].map(
          faceIndex => this.shape.faces[faceIndex]
        )
        const verticesIndices = this.dedupVertexGeometriesIndices[i]
        const indices = []
        faces.forEach(face => {
          face.forEach((verticeIndex, i) => {
            indices.push(
              verticesIndices.indexOf(verticeIndex),
              verticesIndices.indexOf(face[(i + 1) % face.length])
            )
          })
        })
        geometry.setIndex(indices)
      })
    }

    if (this.usePoints) {
      this.pointsGeometries = this.dedupVertexGeometriesIndices.map(
        verticesIndices => this.initGeometry(verticesIndices.length)
      )
    }

    if (this.useColors) {
      const colorGetter = this.colorGenerator({
        shape: this.shape,
        colors: this.colors,
      })
      if (this.useFaces) {
        this.geometries.forEach((geometry, cellIndex) => {
          let pos = 0
          const faces = this.shape.cells[cellIndex].map(
            faceIndex => this.shape.faces[faceIndex]
          )
          faces.forEach((face, faceIndex) => {
            face.forEach(verticeIndex => {
              const [r, g, b] = colorGetter({
                cell: cellIndex,
                face: faceIndex,
                vertice: verticeIndex,
                type: 'face',
              }).toArray()
              geometry.attributes.color.array[pos++] = r
              geometry.attributes.color.array[pos++] = g
              geometry.attributes.color.array[pos++] = b
            })
          })
          geometry.attributes.color.needsUpdate = true
        })
      }
      if (this.useEdges) {
        this.dedupVertexGeometriesIndices.forEach(
          (verticesIndex, cellIndex) => {
            const geometry = this.edgesGeometries[cellIndex]
            let pos = 0
            verticesIndex.forEach(verticeIndex => {
              const [r, g, b] = colorGetter({
                cell: cellIndex,
                face: null,
                vertice: verticeIndex,
                type: 'edge',
              }).toArray()
              geometry.attributes.color.array[pos++] = r
              geometry.attributes.color.array[pos++] = g
              geometry.attributes.color.array[pos++] = b
            })
            geometry.attributes.color.needsUpdate = true
          }
        )
      }
      if (this.usePoints) {
        this.dedupVertexGeometriesIndices.forEach(
          (verticesIndex, cellIndex) => {
            const geometry = this.pointsGeometries[cellIndex]
            let pos = 0
            verticesIndex.forEach(verticeIndex => {
              const [r, g, b] = colorGetter({
                cell: cellIndex,
                face: null,
                vertice: verticeIndex,
                type: 'point',
              }).toArray()
              geometry.attributes.color.array[pos++] = r
              geometry.attributes.color.array[pos++] = g
              geometry.attributes.color.array[pos++] = b
            })
            geometry.attributes.color.needsUpdate = true
          }
        )
      }
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
    const vertices = this.shape.vertices.map(
      this.hyperRenderer.project.bind(this.hyperRenderer)
    )
    if (this.useFaces) {
      this.vertexGeometriesIndices.map((vertexIndices, i) => {
        const geometry = this.geometries[i]

        for (let i = 0, n = vertexIndices.length; i < n; i++) {
          const [x, y, z] = vertices[vertexIndices[i]]
          geometry.attributes.position.array[i * 3] = x
          geometry.attributes.position.array[i * 3 + 1] = y
          geometry.attributes.position.array[i * 3 + 2] = z
        }

        geometry.attributes.position.needsUpdate = true
        geometry.computeVertexNormals()
        geometry.attributes.normal.needsUpdate = true
      })
    }

    if (this.useEdges) {
      this.dedupVertexGeometriesIndices.map((vertexIndices, i) => {
        const geometry = this.edgesGeometries[i]
        for (let i = 0, n = vertexIndices.length; i < n; i++) {
          const [x, y, z] = vertices[vertexIndices[i]]
          geometry.attributes.position.array[i * 3] = x
          geometry.attributes.position.array[i * 3 + 1] = y
          geometry.attributes.position.array[i * 3 + 2] = z
        }

        geometry.attributes.position.needsUpdate = true
      })
    }

    if (this.usePoints) {
      this.dedupVertexGeometriesIndices.map((vertexIndices, i) => {
        const geometry = this.pointsGeometries[i]
        for (let i = 0, n = vertexIndices.length; i < n; i++) {
          const [x, y, z] = vertices[vertexIndices[i]]
          geometry.attributes.position.array[i * 3] = x
          geometry.attributes.position.array[i * 3 + 1] = y
          geometry.attributes.position.array[i * 3 + 2] = z
        }

        geometry.attributes.position.needsUpdate = true
      })
    }
  }
}
