import { Group, Mesh, Vector3 } from 'three'

export default class HyperMesh extends Group {
  constructor(geometries, materials, MeshClass = Mesh) {
    super()
    this.cellSize = 100
    this.geometries
    this.materials = Array.isArray(materials)
      ? materials
      : Array(geometries.length).fill(materials)

    this.add(
      ...geometries.map(
        (geometry, i) => new MeshClass(geometry, this.materials[i])
      )
    )
  }

  update() {
    this.children.map(mesh => {
      const center = new Vector3()
      mesh.geometry.computeBoundingBox()
      mesh.geometry.boundingBox.getCenter(center)
      mesh.geometry.center()
      mesh.position.copy(center)
      mesh.scale.setScalar(Math.min(this.cellSize / 100, 0.999))
    })
  }
}
